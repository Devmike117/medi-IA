import { GoogleGenerativeAI } from "@google/generative-ai";

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

// Función para detectar el navegador
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

// Obtener las cámaras disponibles y llenar el selector
async function getCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    // Limpiar opciones anteriores
    cameraSelect.innerHTML = '';

    // Agregar las cámaras disponibles al selector
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
            captureBtn.disabled = false;  // Activar el botón de captura cuando la cámara esté activa
            cameraBtn.textContent = "Desactivar cámara";  // Cambiar texto del botón
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
        cameraBtn.textContent = "Activar cámara";
        cameraStream = null;
    }
}

// Alternar entre activar y desactivar la cámara
cameraBtn.addEventListener('click', function() {
    if (cameraStream) {
        deactivateCamera();  // Si ya hay una cámara activa, desactívala
    } else {
        showModal(); // Mostrar el modal para seleccionar cámara
    }
});

// Cuando se seleccione una cámara y se presione el botón "Seleccionar cámara"
selectCameraBtn.addEventListener('click', function() {
    const selectedCameraId = cameraSelect.value;
    activateCamera(selectedCameraId);
    closeModal();
});

// Cerrar el modal cuando se presiona el botón "Cerrar"
closeModalBtn.addEventListener('click', closeModal);

// Captura de imagen y manejo de texto
captureBtn.addEventListener('click', async function() {
    if (captureBtn.textContent === "Capturar texto") {
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

                const prompt = `El siguiente texto ha sido detectado: "${text}". responde en español de forma con "nombre cientifico", "Acción farmacológica", "Indicaciones", "Farmacocinética", "Reacciones" de lo contrario muestra 
                "El texto proporcionado no tiene relación con la medicina. Por lo tanto, no puedo ofrecer una respuesta".`;

                try {
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    const textResponse = await response.text();
                    geminiOutput.textContent = textResponse;

                    // Agregar la consulta detectada y la respuesta al historial
                    agregarAlHistorial(text, textResponse);
                    
                } catch (error) {
                    console.error('Error al interactuar:', error);
                    geminiOutput.textContent = `Error: ${error.message}`;
                }

                // Cambiar el botón para eliminar texto
                captureBtn.textContent = "Eliminar texto";
            } else {
                textOutput.textContent = 'No se detectó texto o hubo un error en el OCR.';
            }
        } catch (error) {
            console.error('Error con OCR.space:', error);
            textOutput.textContent = 'Error al procesar la imagen.';
        }
    } else {
        // Limpiar el texto y restablecer el botón
        textOutput.textContent = '';
        geminiOutput.textContent = '';
        captureBtn.textContent = "Capturar texto";
    }
});

// Gemini API
const apiKeyGemini = "AIzaSyCXZ5cLD8Xh2DWaP4wEuR-_uTpJ1B4gXDs"; // API Key de Gemini
const genAI = new GoogleGenerativeAI(apiKeyGemini);
const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // Modelo IA 

// Llamar a la función para obtener las cámaras al cargar la página
getCameras();

// Almacenar consultas en localStorage y actualizarlas
function agregarAlHistorial(consulta, respuesta) {
    let historial = JSON.parse(localStorage.getItem('historial')) || [];
    // Verificar si la consulta ya existe en el historial
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
        // Si está vacío, mostrar el historial
        resultadoConsulta.innerHTML = ""; // Limpiar el área de resultado antes de mostrar el historial

        const historial = JSON.parse(localStorage.getItem('historial')) || [];
        if (historial.length > 0) {
            historial.forEach((item, index) => {
                // Crear un contenedor para cada consulta
                const divConsulta = document.createElement('div');
                divConsulta.style.display = "flex";
                divConsulta.style.alignItems = "center";
                divConsulta.style.justifyContent = "space-between";
                divConsulta.style.marginBottom = "5px";

                // Crear un enlace para cada consulta con número de orden
                const link = document.createElement('a');
                link.href = "#"; // Aquí puedes cambiar para redirigir a la respuesta real si es necesario
                link.textContent = `${index + 1}. ${item.consulta}`; // Número de orden y texto de la consulta
                link.style.color = "blue"; // Cambia el color según tu estilo
                link.style.cursor = "pointer"; // Cambia el cursor al pasar por encima

                // Mostrar la respuesta al hacer clic en la consulta
                link.addEventListener('click', () => {
                    resultadoConsulta.innerHTML = `<strong>Respuesta:</strong> ${item.respuesta}`;
                });

                // Crear un botón de eliminar
                const botonEliminar = document.createElement('button');
                botonEliminar.textContent = "Eliminar";
                botonEliminar.style.marginLeft = "10px";
                botonEliminar.style.cursor = "pointer";
                botonEliminar.style.backgroundColor = "red";
                botonEliminar.style.color = "white";
                botonEliminar.style.border = "none";
                botonEliminar.style.padding = "5px 10px";
                botonEliminar.style.borderRadius = "5px";

                // Evento para eliminar la consulta del historial
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

                // Añadir el contenedor de consulta al resultado
                resultadoConsulta.appendChild(divConsulta);
            });
        } else {
            resultadoConsulta.innerHTML = "No hay consultas previas en el historial.";
        }

        // Cambiar el texto del botón a "Cerrar Historial"
        botonHistorial.textContent = "Cerrar Historial";
    } else {
        // Si el historial está visible, cerrar el historial
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
        const prompt = `${consulta}. responde en español de forma con "nombre cientifico", "Acción farmacológica", "Indicaciones", "Farmacocinética", "Reacciones" de lo contrario muestra 
        "El texto proporcionado no tiene relación con la medicina. Por lo tanto, no puedo ofrecer una respuesta"`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        
        // Agregar al historial con la respuesta
        agregarAlHistorial(consulta, text); 
        
        // Mostrar la respuesta directamente desde `text`
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

// Llamar a la función para obtener las cámaras al cargar la página
getCameras();
