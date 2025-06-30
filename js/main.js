// Autor: Miguel GH

// Importar la clase GoogleGenerativeAI desde el paquete @google/generative-ai
import { GoogleGenerativeAI } from "@google/generative-ai";

// Elementos de la interfaz de usuario
const video = document.getElementById('video');
const captureBtn = document.getElementById('capture-btn');
const cameraBtn = document.getElementById('camera-btn');
const cameraSelect = document.getElementById('camera-select');
const cameraModal = document.getElementById('camera-modal');
const closeModalBtn = document.getElementById('close-modal');
const selectCameraBtn = document.getElementById('select-camera-btn');
const canvas = document.getElementById('canvas');
const textOutput = document.getElementById('text-output');
const geminiOutput = document.getElementById('gemini-output');
let cameraStream = null;

// Función para detectar el navegador del usuario
function detectBrowser() {
    const userAgent = navigator.userAgent;

    if (userAgent.indexOf("Chrome") > -1) {
        return "Chrome";
    } else if (userAgent.indexOf("Firefox") > -1) {
        return "Firefox";
    } else if (userAgent.indexOf("Safari") > -1) {
        return "Safari";
    } else if (userAgent.indexOf("Edge") > -1) {
        return "Edge";
    } else {
        return "Otro";
    }
}

// Función para solicitar permisos de cámara
async function requestCameraPermission() {
    const browser = detectBrowser();

    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        console.log(`Permisos de cámara otorgados en ${browser}.`);
    } catch (error) {
        console.error(`Error al obtener permisos de cámara en ${browser}:`, error);
        if (error.name === 'NotAllowedError') {
            alert("Permiso denegado. Por favor, permite el acceso a la cámara en la configuración del navegador.");
        } else if (error.name === 'NotFoundError') {
            alert("No se encontró la cámara. Asegúrate de que esté conectada.");
        } else {
            alert("Error al acceder a la cámara: " + error.message);
        }
    }
}

// Función para mostrar el modal
function showModal() {
    cameraModal.style.display = 'flex';
}

// Función para ocultar el modal
function closeModal() {
    cameraModal.style.display = 'none';
}

// Obtener las cámaras disponibles
async function getCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    // Limpiar opciones anteriores
    cameraSelect.innerHTML = '';

    // Crear una opción para cada cámara disponible
    videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Cámara ${index + 1}`;
        cameraSelect.appendChild(option);
    });
}

// Función para activar la cámara seleccionada
async function activateCamera(deviceId) {
    console.log('Activando cámara con deviceId:', deviceId);
    await requestCameraPermission(); // Solicitar permisos antes de activar la cámara

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const constraints = {
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 440 },
                    height: { ideal: 280 }
                }
            };

            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = cameraStream;

            // Voltear el video horizontalmente modo espejo
            video.style.transform = "scaleX(-1)"; 

            // Activar el botón de captura cuando la cámara esté activa
            captureBtn.disabled = false;  

            // Cambiar texto del botón
            cameraBtn.textContent = "Desactivar cámara ";  
        } catch (err) {
            console.error("Error al activar la cámara:", err);
        }
    } else {
        alert("Tu navegador no soporta acceso a la cámara.");
    }
}


// Función para desactivar la cámara
function deactivateCamera() {
    if (cameraStream) {
        const tracks = cameraStream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        captureBtn.disabled = true;
        const cameraBtn = document.getElementById("camera-btn");

cameraBtn.innerHTML = `
    <i class="fas fa-camera"></i>
    Activar cámara <br>
    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
        <path fill-rule="evenodd" d="M7.5 4.586A2 2 0 0 1 8.914 4h6.172a2 2 0 0 1 1.414.586L17.914 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.086L7.5 4.586ZM10 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm2-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" clip-rule="evenodd"/>
    </svg>
    
`;

        cameraStream = null;
    }
}

// Botón para activar/desactivar la cámara
cameraBtn.addEventListener('click', function() {
    if (cameraStream) {
        deactivateCamera();  // Desactivar la cámara
    } else {
        showModal(); // Mostrar el modal para seleccionar la cámara
    }
});

// Seleccionar la cámara y activarla
selectCameraBtn.addEventListener('click', function() {
    const selectedCameraId = cameraSelect.value;
    activateCamera(selectedCameraId);
    closeModal();
});

// Cerrar el modal al hacer clic en el botón de cerrar
closeModalBtn.addEventListener('click', closeModal);

// Capturar texto de la imagen
captureBtn.addEventListener('click', async function() {
    // Verificar si el botón está en modo "Eliminar texto"
    if (captureBtn.textContent === "Eliminar texto") {
        resetCaptureButton(); // Restablecer el botón
        geminiOutput.textContent = '';  // Limpiar la salida
        textOutput.textContent = '';    // Limpiar la salida
        return; // Salir de la función
    }

    // Cambiar el texto del botón a "Capturando texto" y deshabilitar el botón
    captureBtn.textContent = "Capturando texto";
    captureBtn.disabled = true; // Deshabilitar el botón mientras se procesa la captura

    // Capturar la imagen
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL("image/png");

    // OCR.space API
    const apiKey = "K85871041088957"; // API key de OCR.space
    const formData = new FormData();
    formData.append("base64image", imageData);
    formData.append("language", "spa");

    try {
        const response = await fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            headers: { apikey: apiKey },
            body: formData
        });

        const result = await response.json();
        if (result.OCRExitCode === 1) {
            const text = result.ParsedResults[0].ParsedText;
            textOutput.textContent = text;

            const prompt = `
            El siguiente texto ha sido detectado: "${text}". 
            Si el texto hace referencia a un medicamento, responde con los siguientes detalles de manera muy resumida y organizada en formato de lista alineada con espacios, arregla el nombre del medicamento si no se detecto correctamente con el OCR:


            1. Nombre comercial: el nombre del medicamento tal como aparece en la caja o envase.

            2. Nombre científico: el nombre genérico del medicamento.

            3. Compuestos activos: los ingredientes activos que componen el medicamento.

            4. Acción farmacológica: describe brevemente el efecto del medicamento en el cuerpo.

            5. Indicaciones: los usos terapéuticos o condiciones que el medicamento trata.

            6. Farmacocinética: cómo el cuerpo absorbe, distribuye, metaboliza y excreta el medicamento.
            
            7. Reacciones adversas: posibles efectos secundarios del medicamento.

            Si el texto  no hace referencia a un medicamento, responde: 
            "El texto proporcionado no tiene relación con la medicina. Por lo tanto, no puedo ofrecer una respuesta."`;

            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const textResponse = await response.text();
                geminiOutput.textContent = textResponse;

                // Agregar la consulta detectada y la respuesta al historial
                agregarAlHistorial(text, textResponse);

                const responseText = await response.text();

                // Verificar si la respuesta contiene algo relacionado con medicamentos
                if (responseText.toLowerCase().includes('medicamento') || responseText.toLowerCase().includes('nombre comercial')) {
                    geminiOutput.textContent = responseText;
                } else {
                    geminiOutput.textContent = "El texto proporcionado no parece estar relacionado con un medicamento.";
                }

            } catch (error) {
                console.error('Error al interactuar:', error);
                geminiOutput.textContent = `Error: ${error.message}`;
            }

            // Cambiar el texto del botón a "Eliminar texto" y habilitar el botón
            captureBtn.textContent = "Eliminar texto";  // Cambiar el texto del botón
            captureBtn.disabled = false;  // Habilitar el botón nuevamente

        } else {
            textOutput.textContent = 'No se detectó texto o hubo un error en el OCR.';
            resetCaptureButton();  // Restablecer el botón
        }
    } catch (error) {
        console.error('Error con OCR.space:', error);
        textOutput.textContent = 'Error al procesar la imagen.';
        resetCaptureButton();  // Restablecer el botón
    }
});

// Función para restablecer el estado del botón de captura
function resetCaptureButton() {
    captureBtn.textContent = "Capturar texto";  // Cambiar el texto del botón a "Capturar texto"
    captureBtn.disabled = false;  // Habilitar el botón nuevamente
}



// Función de búsqueda por voz
function startVoiceSearch() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'es-ES'; // Establecer el idioma español

    // Cambiar el texto del botón a "Escuchando..." y cambiar el ícono
    voiceRecordBtn.innerHTML = `
        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
            <path fill-rule="evenodd" d="M5 8a1 1 0 0 1 1 1v3a4.006 4.006 0 0 0 4 4h4a4.006 4.006 0 0 0 4-4V9a1 1 0 1 1 2 0v3.001A6.006 6.006 0 0 1 14.001 18H13v2h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2H9.999A6.006 6.006 0 0 1 4 12.001V9a1 1 0 0 1 1-1Z" clip-rule="evenodd"/>
            <path d="M7 6a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V6Z"/>
        </svg>
        Escuchando...`;

    recognition.start();

    recognition.onresult = async (event) => {
        const voiceText = event.results[0][0].transcript;
        geminiOutput.textContent = `Texto detectado por voz: ${voiceText}`;

        // Establecer el prompt con el texto detectado por voz
        const prompt = `
            El siguiente texto ha sido detectado: "${voiceText}". 
            Si el texto hace referencia a un medicamento, responde con los siguientes detalles de manera muy resumida y organizada en formato de lista alineada con espacios, arregla el nombre del medicamento si no se detecto correctamente con el OCR:

            1. Nombre comercial: el nombre del medicamento tal como aparece en la caja o envase.
            2. Nombre científico: el nombre genérico del medicamento.
            3. Compuestos activos: los ingredientes activos que componen el medicamento.
            4. Acción farmacológica: describe brevemente el efecto del medicamento en el cuerpo.
            5. Indicaciones: los usos terapéuticos o condiciones que el medicamento trata.
            6. Farmacocinética: cómo el cuerpo absorbe, distribuye, metaboliza y excreta el medicamento.
            7. Reacciones adversas: posibles efectos secundarios del medicamento.

            Si el texto no hace referencia a un medicamento, responde: 
            "El texto proporcionado no tiene relación con la medicina. Por lo tanto, no puedo ofrecer una respuesta."`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const textResponse = await response.text();
            geminiOutput.textContent = textResponse;

            // Agregar la consulta y la respuesta al historial
            agregarAlHistorial(voiceText, textResponse);

        } catch (error) {
            console.error('Error al interactuar:', error);
            geminiOutput.textContent = `Error: ${error.message}`;
        }

        // Volver a cambiar el texto del botón y el ícono a su estado original después de procesar la voz
        voiceRecordBtn.innerHTML = `
            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                <path fill-rule="evenodd" d="M5 8a1 1 0 0 1 1 1v3a4.006 4.006 0 0 0 4 4h4a4.006 4.006 0 0 0 4-4V9a1 1 0 1 1 2 0v3.001A6.006 6.006 0 0 1 14.001 18H13v2h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2H9.999A6.006 6.006 0 0 1 4 12.001V9a1 1 0 0 1 1-1Z" clip-rule="evenodd"/>
                <path d="M7 6a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V6Z"/>
            </svg>
            Buscar por voz`;
    };

    recognition.onerror = (error) => {
        console.error("Error de reconocimiento de voz:", error);
        geminiOutput.textContent = "Error al reconocer el discurso.";

        // Volver a cambiar el texto del botón y el ícono a su estado original en caso de error
        voiceRecordBtn.innerHTML = `Búsqueda por voz <br>

            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                <path fill-rule="evenodd" d="M5 8a1 1 0 0 1 1 1v3a4.006 4.006 0 0 0 4 4h4a4.006 4.006 0 0 0 4-4V9a1 1 0 1 1 2 0v3.001A6.006 6.006 0 0 1 14.001 18H13v2h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2H9.999A6.006 6.006 0 0 1 4 12.001V9a1 1 0 0 1 1-1Z" clip-rule="evenodd"/>
                <path d="M7 6a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V6Z"/>
            </svg>
            `;
    };
}

// Iniciar la búsqueda por voz cuando se hace clic en el botón
const voiceRecordBtn = document.getElementById('voice-record');
voiceRecordBtn.addEventListener('click', startVoiceSearch);


// Gemini API
const apiKeyGemini = "AIzaSyDcMWvuS-V0NzeNKpRzEMKgk7x1J8XC7ZM"; // API Key de Gemini
const genAI = new GoogleGenerativeAI(apiKeyGemini);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Modelo de IA de Gemini

// Obtener las cámaras disponibles al cargar la página
getCameras();

// Almacenar consultas en localStorage y actualizarlas
function agregarAlHistorial(consulta, respuesta) {
    let historial = JSON.parse(localStorage.getItem('historial')) || [];
    // Verificar si la consulta ya está en el historial
    if (!historial.some(item => item.consulta === consulta)) {
        historial.push({ consulta, respuesta });
        localStorage.setItem('historial', JSON.stringify(historial));
    }
}

// Mostrar/ocultar historial en el cuadro de resultado
document.getElementById("botonHistorial").addEventListener("click", () => {
    const resultadoConsulta = document.getElementById("resultadoConsulta");
    const botonHistorial = document.getElementById("botonHistorial");

    // Verificar si el historial ya está visible
    if (resultadoConsulta.innerHTML === "") {
        // Si el historial no está visible, mostrarlo
        resultadoConsulta.innerHTML = ""; // Limpiar el área de resultado antes de mostrar el historial

        const historial = JSON.parse(localStorage.getItem('historial')) || [];
        if (historial.length > 0) {
            historial.forEach((item, index) => {
                // Crear un contenedor para cada consulta y respuesta
                const divConsulta = document.createElement('div');
                divConsulta.style.display = "flex";
                divConsulta.style.alignItems = "center";
                divConsulta.style.justifyContent = "space-between";
                divConsulta.style.marginBottom = "5px";

                // Crear un enlace para mostrar la consulta y la respuesta
                const link = document.createElement('a');
                link.href = "#"; // Enlace personalizado
                link.textContent = `${index + 1}. ${item.consulta}`; // Texto del enlace
                link.style.color = "blue"; // Color del enlace
                link.style.cursor = "pointer"; // Cambia el cursor al pasar por encima

                // Mostrar la respuesta al hacer clic en el enlace
                link.addEventListener('click', () => {
                    resultadoConsulta.innerHTML = `<strong>Respuesta:</strong> ${item.respuesta}`;
                });

                // Crear un botón para eliminar cada consulta
                const botonEliminar = document.createElement('button');
                botonEliminar.textContent = "Eliminar";
                botonEliminar.style.marginLeft = "10px";
                botonEliminar.style.cursor = "pointer";
                botonEliminar.style.backgroundColor = "red";
                botonEliminar.style.color = "white";
                botonEliminar.style.border = "none";
                botonEliminar.style.padding = "5px 10px";
                botonEliminar.style.borderRadius = "5px";

                // Eliminar la consulta al hacer clic en el botón
                botonEliminar.addEventListener('click', () => {
                    // Eliminar la consulta del historial
                    historial.splice(index, 1);
                    localStorage.setItem('historial', JSON.stringify(historial));
                    // Actualizar la vista del historial
                    mostrarHistorial();
                });

                // Añadir el enlace y el botón al contenedor de consulta
                divConsulta.appendChild(link);
                divConsulta.appendChild(botonEliminar);

                // Añadir el contenedor al área de resultado
                resultadoConsulta.appendChild(divConsulta);
            });
        } else {
            resultadoConsulta.innerHTML = "No hay consultas previas en el historial.";
        }

        // Cambiar el texto del botón a "Cerrar Historial"
        botonHistorial.textContent = "Cerrar Historial";
    } else {
        // Si el historial ya está visible, ocultarlo
        resultadoConsulta.innerHTML = ""; // Limpiar el área de resultado
        botonHistorial.textContent = "Ver Historial"; // Cambiar el texto del botón a "Ver Historial"
    }
});

// Función para mostrar el historial actualizado
function mostrarHistorial() {
    const resultadoConsulta = document.getElementById("resultadoConsulta");
    resultadoConsulta.innerHTML = ""; // Limpiar el área de resultado antes de mostrar el historial

    const historial = JSON.parse(localStorage.getItem('historial')) || [];
    if (historial.length > 0) {
        historial.forEach((item, index) => {
            const divConsulta = document.createElement('div');
            divConsulta.style.display = "flex";
            divConsulta.style.alignItems = "center";
            divConsulta.style.justifyContent = "space-between";
            divConsulta.style.marginBottom = "5px";

            const link = document.createElement('a');
            link.href = "#";
            link.textContent = `${index + 1}. ${item.consulta}`;
            link.style.color = "blue";
            link.style.cursor = "pointer";

            link.addEventListener('click', () => {
                resultadoConsulta.innerHTML = `<strong>Respuesta:</strong> ${item.respuesta}`;
            });

            const botonEliminar = document.createElement('button');
            botonEliminar.textContent = "Eliminar";
            botonEliminar.style.marginLeft = "10px";
            botonEliminar.style.cursor = "pointer";
            botonEliminar.style.backgroundColor = "red";
            botonEliminar.style.color = "white";
            botonEliminar.style.border = "none";
            botonEliminar.style.padding = "5px 10px";
            botonEliminar.style.borderRadius = "5px";

            botonEliminar.addEventListener('click', () => {
                historial.splice(index, 1);
                localStorage.setItem('historial', JSON.stringify(historial));
                mostrarHistorial();
            });

            divConsulta.appendChild(link);
            divConsulta.appendChild(botonEliminar);
            resultadoConsulta.appendChild(divConsulta);
        });
    } else {
        resultadoConsulta.innerHTML = "No hay consultas previas en el historial.";
    }
}

// Botón para exportar el historial en .TXT
const exportarBtn = document.getElementById("exportarHistorial");

// Función para exportar el historial a un archivo .TXT
exportarBtn.addEventListener("click", () => {
    exportarHistorial();
});

function exportarHistorial() {
    // Recuperar el historial del localStorage
    const historial = JSON.parse(localStorage.getItem('historial')) || [];
    
    // Verificar si el historial está vacío
    if (historial.length === 0) {
        alert("No hay consultas en el historial para exportar.");
        return;
    }

    // Convertir el historial en texto
    let historialTexto = "Historial de Consultas y Respuestas:\n\n";

    historial.forEach((item, index) => {
        historialTexto += `Consulta ${index + 1}:\n`;
        historialTexto += `Consulta: ${item.consulta}\n`;
        historialTexto += `Respuesta: ${item.respuesta}\n\n`;
    });

    // Crear un Blob con el contenido del historial
    const blob = new Blob([historialTexto], { type: "text/plain" });

    // Crear un enlace para descargar el archivo
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = "historial_consultas.txt";  // Nombre del archivo
    enlace.click();
}

// Consultar y agregar al historial
document.querySelector("#botonConsulta").addEventListener("click", async () => {
    toggleButtonState(true);
    const consulta = document.querySelector("#consulta").value.trim(); // Remover espacios en blanco
    const resultadoConsulta = document.querySelector("#resultadoConsulta");

    // Verificar si la consulta está vacía
    if (consulta === "") {
        resultadoConsulta.innerHTML = '<span style="color: red;">Por favor, escribe algo válido para realizar la consulta.</span>';
        toggleButtonState(false); // Habilitar el botón de nuevo
        return; // Salir de la función para no hacer la búsqueda
    }

    try {
        const prompt = `${consulta}. Responde con los siguientes detalles, solo si son nombres de medicamentos, marcas de medicamentos y todo lo realacionado a medicamentos y sector salud, pero no muestres las indicaciones de busqueda de te doy, solo muestra "Aquí tienes la información sobre:: y nombre del lo que se busco: 

            1. Nombre comercial: el nombre del medicamento tal como aparece en la caja o envase.

            2. Nombre científico: el nombre genérico del medicamento.

            3. Compuestos activos: los ingredientes activos que componen el medicamento.

            4. Acción farmacológica: describe brevemente el efecto del medicamento en el cuerpo.

            5. Indicaciones: los usos terapéuticos o condiciones que el medicamento trata.

            6. Farmacocinética: cómo el cuerpo absorbe, distribuye, metaboliza y excreta el medicamento.
            
            7. Reacciones adversas: posibles efectos secundarios del medicamento.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        
        // Agregar al historial con la respuesta
        agregarAlHistorial(consulta, text); 
        
        // Mostrar la respuesta en el cuadro de resultado
        resultadoConsulta.innerHTML = `<strong>Respuesta:</strong> ${text}`; 

    } catch (error) {
        resultadoConsulta.innerHTML = 'Problemas en la consulta: ' + error.message;
    }
    toggleButtonState(false);
});

function toggleButtonState(disable) {
    const botonConsulta = document.querySelector("#botonConsulta");
    botonConsulta.disabled = disable;
    botonConsulta.innerText = disable ? "Consultando..." : "Consultar";
}

// Actualiza el año en el pie de página
document.getElementById('year').textContent = new Date().getFullYear();

// Llamar a la función para obtener las cámaras al cargar la página
getCameras();
