document.addEventListener('DOMContentLoaded', function() {
    // --- Elementos da DOM ---
    const fileInput = document.getElementById('file-input');
    const processButton = document.getElementById('process-button');
    const container = document.getElementById('report-container');
    const fileInfo = document.getElementById('file-info');
    const dropArea = document.getElementById('file-drop-area');
    const reportActions = document.getElementById('report-actions');
    const reportOutput = document.getElementById('report-output');
    const searchInput = document.getElementById('search-input');

    let selectedFile = null;
    let reportDataGlobal = null;

    // --- Lógica de Upload ---
    const updateFileInfo = () => {
        if (fileInput.files.length > 0) {
            selectedFile = fileInput.files[0];
            fileInfo.textContent = `Arquivo selecionado: ${selectedFile.name}`;
            processButton.disabled = false;
        } else {
            selectedFile = null;
            fileInfo.textContent = '';
            processButton.disabled = true;
        }
    };
    
    fileInput.addEventListener('change', updateFileInfo);
    processButton.addEventListener('click', handleFile);
    processButton.disabled = true;

    // --- Lógica de Drag & Drop ---
    dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('drag-over'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            updateFileInfo();
        }
    });
    
    // --- Event Listener para Pesquisa ---
    searchInput.addEventListener('input', (e) => {
        if (reportDataGlobal) {
            renderReport(reportDataGlobal, e.target.value);
        }
    });

    // --- Lógica de Processamento ---
    function handleFile() {
        if (!selectedFile) {
            alert("Por favor, selecione um arquivo primeiro.");
            return;
        }
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const reportData = parseExcelRelatorio(event.target.result);
                reportDataGlobal = reportData;
                searchInput.value = ''; // Limpa a pesquisa ao carregar novo arquivo
                renderReport(reportData);
            } catch (error) {
                console.error("Erro ao processar o arquivo:", error);
                alert(`Ocorreu um erro: ${error.message}`);
            }
        };
        reader.onerror = () => alert("Não foi possível ler o arquivo.");
        reader.readAsText(selectedFile, 'ISO-8859-1');
    }
    
    // --- Parser customizado e robusto para o formato de relatório textual ---
    function parseExcelRelatorio(content) {
        const lines = content.split(/\r?\n/);
        const reportData = {};
        let currentDate = null;
        let currentLinha = null;
        let currentCarro = null;
        let isParsingTrips = false;

        for (const line of lines) {
            const trimmedLine = line.trim();
            const upperLine = trimmedLine.toUpperCase();

            if (trimmedLine.replace(/;/g, '') === '') {
                if(isParsingTrips) isParsingTrips = false;
                continue;
            }

            if (upperLine.includes(';DATA:')) {
                const match = trimmedLine.match(/(\d{2}\/\d{2}\/\d{4})/);
                if (match) {
                    currentDate = match[1];
                    currentLinha = null; currentCarro = null; isParsingTrips = false;
                    if (!reportData[currentDate]) reportData[currentDate] = {};
                    continue;
                }
            }

            if (upperLine.includes(';LINHA:')) {
                const match = trimmedLine.match(/;Linha:\s*([A-Z0-9]+)/i); // Captura letras e números
                if (match && currentDate) {
                    currentLinha = match[1].toUpperCase();
                    currentCarro = null; isParsingTrips = false;
                    if (!reportData[currentDate][currentLinha]) reportData[currentDate][currentLinha] = {};
                    continue;
                }
            }
            
            if (upperLine.includes(';VEÍCULO:')) {
                const match = trimmedLine.match(/\d+/);
                 if (match && currentDate && currentLinha) {
                    currentCarro = match[0];
                    isParsingTrips = false;
                    if (!reportData[currentDate][currentLinha][currentCarro]) {
                        reportData[currentDate][currentLinha][currentCarro] = [];
                    }
                    continue;
                }
            }
            
            if (upperLine.includes(';INÍCIO;FIM;')) {
                if (currentCarro) {
                    isParsingTrips = true;
                }
                continue;
            }

            if (isParsingTrips) {
                const match = trimmedLine.match(/^;(\d{2}:\d{2})/);
                if (match) {
                    const horario = match[1];
                    if (currentDate && currentLinha && currentCarro) {
                        reportData[currentDate][currentLinha][currentCarro].push(horario);
                    }
                } else {
                    isParsingTrips = false;
                }
            }
        }
        return reportData;
    }

    // --- Lógica de Renderização ---
    function renderReport(data, filter = '') {
        const searchTerm = filter.trim().toLowerCase();
        container.innerHTML = '';
        
        if (Object.keys(data).length === 0) {
            reportActions.classList.add('hidden');
            container.innerHTML = `<div id="placeholder" class="text-center py-16 text-gray-500 dark:text-gray-400">...</div>`;
            return;
        }
        
        reportActions.classList.remove('hidden');
        document.getElementById('print-button').addEventListener('click', printReport);
        document.getElementById('download-csv-button').addEventListener('click', downloadCSV);
        document.getElementById('download-excel-button').addEventListener('click', exportToExcel);
        document.getElementById('share-email-button').addEventListener('click', shareViaEmail);
        document.getElementById('share-whatsapp-button').addEventListener('click', shareViaWhatsApp);


        let animationDelay = 0;
        let hasAnyResults = false;
        const sortedDates = Object.keys(data).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split('/');
            const [dayB, monthB, yearB] = b.split('/');
            return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
        });

        sortedDates.forEach(date => {
            const lines = data[date];
            let totalViagensDia = 0;
            let lineContent = '';
            let dayHasVisibleContent = false;

            for (const line in lines) {
                const vehicles = lines[line];
                let totalViagensLinha = 0;
                let vehicleContent = '';
                let lineHasVisibleContent = false;

                const sortedVehicles = Object.keys(vehicles).sort((a, b) => a - b);
                sortedVehicles.forEach(vehicle => {
                    const trips = vehicles[vehicle];
                    
                    const vehicleMatches = vehicle.includes(searchTerm);
                    const lineMatches = line.toLowerCase().includes(searchTerm);

                    if(trips.length > 0 && (searchTerm === '' || vehicleMatches || lineMatches)) {
                        lineHasVisibleContent = true;
                        totalViagensLinha += trips.length;
                        const tripList = trips.sort().map(time => `<li class="bg-gray-200 dark:bg-gray-600 rounded-md px-2 py-1 text-sm">${time}</li>`).join('');
                        vehicleContent += `<div class="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-lg shadow-sm">
                            <div class="flex justify-between items-center mb-3">
                                <h4 class="font-bold text-lg text-blue-600 dark:text-blue-400">Carro: ${vehicle}</h4>
                                <span class="text-sm font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded-full">${trips.length} viagens</span>
                            </div><ul class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">${tripList}</ul></div>`;
                    }
                });
                
                if(lineHasVisibleContent) {
                    dayHasVisibleContent = true;
                    totalViagensDia += totalViagensLinha;
                    const isSpecialLine = /[a-zA-Z]/.test(line);

                    const headerClass = isSpecialLine 
                        ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white' 
                        : 'bg-gray-200 dark:bg-gray-700';
                    
                    const titleClass = isSpecialLine
                        ? 'text-white'
                        : 'text-gray-800 dark:text-gray-100';
                    
                    const totalClass = isSpecialLine
                        ? 'text-yellow-100'
                        : 'text-gray-700 dark:text-gray-300';

                    lineContent += `<div class="mt-4"><div class="flex justify-between items-center ${headerClass} p-3 rounded-t-lg">
                        <h3 class="text-xl font-semibold ${titleClass}">Linha: ${line}</h3>
                        <span class="font-bold ${totalClass}">Total na Linha: ${totalViagensLinha} viagens</span>
                        </div><div class="grid grid-cols-1 ${Object.keys(vehicles).filter(v => vehicles[v].length > 0 && (v.includes(searchTerm) || line.toLowerCase().includes(searchTerm) || searchTerm === '')).length > 1 ? 'md:grid-cols-2' : ''} gap-4 p-4 bg-white dark:bg-gray-800 rounded-b-lg">${vehicleContent}</div></div>`;
                }
            }
            
            if(dayHasVisibleContent) {
                hasAnyResults = true;
                const dayCard = `<section class="fade-in bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden" style="animation-delay: ${animationDelay}ms">
                    <header class="p-4 bg-gradient-to-r from-gray-700 to-gray-800 text-white flex justify-between items-center">
                    <h2 class="text-2xl font-bold"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>${date}</h2>
                    <div class="text-right"><span class="block text-xl font-bold">${totalViagensDia}</span><span class="text-xs text-gray-300">VIAGENS NO DIA</span></div></header>
                    <div class="p-4 md:p-6">${lineContent}</div></section>`;
                container.innerHTML += dayCard;
                animationDelay += 100;
            }
        });
        
         if(!hasAnyResults) {
            container.innerHTML = `<div id="placeholder" class="text-center py-16 text-gray-500 dark:text-gray-400">
                <svg class="w-16 h-16 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <h3 class="mt-4 text-xl font-semibold">Nenhum resultado encontrado</h3>
                <p>Sua busca por "${filter}" não retornou resultados.</p>
            </div>`;
        }
    }

    // --- Funções para Impressão e Download ---
    function printReport() {
        reportOutput.classList.add('print-section');
        window.print();
        reportOutput.classList.remove('print-section');
    }

    function downloadCSV() {
        if (!reportDataGlobal) return;
        let csvContent = "data:text/csv;charset=utf-8,Linha,Data,Carro\n";
        const sortedDates = Object.keys(reportDataGlobal).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split('/');
            const [dayB, monthB, yearB] = b.split('/');
            return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
        });

        sortedDates.forEach(date => {
            const lines = reportDataGlobal[date];
            for (const line in lines) {
                const vehicles = lines[line];
                const sortedVehicles = Object.keys(vehicles).sort((a, b) => a - b);
                sortedVehicles.forEach(vehicle => {
                    if (vehicles[vehicle].length > 0) {
                        const row = [line, date, vehicle].join(',');
                        csvContent += row + "\n";
                    }
                });
            }
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "relatorio_linha_data_carro.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportToExcel() {
        if (!reportDataGlobal) {
            alert("Primeiro processe um arquivo para gerar os dados.");
            return;
        }

        const rows = [];
        const sortedDates = Object.keys(reportDataGlobal).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split('/');
            const [dayB, monthB, yearB] = b.split('/');
            return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
        });

        for (const date of sortedDates) {
            const lines = reportDataGlobal[date];
            const sortedLines = Object.keys(lines).sort();
            
            for (const line of sortedLines) {
                const vehicles = lines[line];
                const sortedVehicles = Object.keys(vehicles).sort((a, b) => a - b);

                for (const vehicle of sortedVehicles) {
                    const trips = vehicles[vehicle];
                    if (trips.length > 0) {
                        rows.push({
                            "Data": date,
                            "Linha": line,
                            "Carro": vehicle,
                            "Nº Viagens": trips.length,
                        });
                    }
                }
            }
        }

        const ws_data = [
            ["Data", "Linha", "Carro", "Nº Viagens"],
            ...rows.map(r => [r.Data, r.Linha, r.Carro, r["Nº Viagens"]])
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // Adiciona o autofiltro para criar a tabela dinâmica
        const range = XLSX.utils.decode_range(ws['!ref']);
        ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

        ws["A1"].s = ws["B1"].s = ws["C1"].s = ws["D1"].s = {
            font: { bold: true }
        };

        ws['!cols'] = [ { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 } ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatório Dinâmico");
        XLSX.writeFile(wb, "relatorio_dinamico.xlsx");
    }
    
    // --- Funções de Partilha ---
    function generatePlainTextReport() {
        if (!reportDataGlobal) return "Nenhum dado para partilhar.";
        
        let reportText = "*Relatório de Viagens - TopBus Transportes S/A*\n\n";
        const sortedDates = Object.keys(reportDataGlobal).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split('/');
            const [dayB, monthB, yearB] = b.split('/');
            return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
        });

        sortedDates.forEach(date => {
            const lines = reportDataGlobal[date];
            let totalViagensDia = 0;
            let dayHasContent = false;
            let dayText = `*Data: ${date}*\n`;

            Object.keys(lines).sort().forEach(line => {
                const vehicles = lines[line];
                let totalViagensLinha = 0;
                Object.values(vehicles).forEach(trips => totalViagensLinha += trips.length);
                
                if (totalViagensLinha > 0) {
                    dayText += `- Linha ${line}: ${totalViagensLinha} viagens\n`;
                    totalViagensDia += totalViagensLinha;
                    dayHasContent = true;
                }
            });

            if (dayHasContent) {
                dayText += `*Total do Dia: ${totalViagensDia} viagens*\n\n`;
                reportText += dayText;
            }
        });
         reportText += "---\nGerado pela Ferramenta de Controle Operacional.";
        return reportText;
    }

    function shareViaEmail() {
        if (!reportDataGlobal) {
            alert("Primeiro processe um arquivo para gerar os dados.");
            return;
        }
        const subject = "Relatório de Viagens";
        const body = "Segue resumo do relatório de viagens. Para uma análise completa, utilize um dos formatos de exportação (CSV ou Excel) e anexe-o a este email.\n\n" + generatePlainTextReport();
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
    }

    function shareViaWhatsApp() {
        if (!reportDataGlobal) {
            alert("Primeiro processe um arquivo para gerar os dados.");
            return;
        }
        const text = "Segue resumo do relatório de viagens. Para uma análise completa, baixe um dos formatos de exportação (CSV ou Excel) e partilhe-o.\n\n" + generatePlainTextReport();
        const whatsappLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(whatsappLink, '_blank');
    }

    // --- Inicialização ---
    document.getElementById('generation-date').textContent = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
});
