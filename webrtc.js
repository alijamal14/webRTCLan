// Build Number: 1.0.0
// --- Additional Information ---
// This is a placeholder for the build number.

// webrtc.js - Modular WebRTC LAN Demo

// WebRTC P2P Demo - Updated 2025-09-17
// Fixed messagesContainer references to use chatMessages

// --- DOM Elements ---
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const callBtn = document.getElementById('callBtn');
const hangupBtn = document.getElementById('hangupBtn');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
const offerText = document.getElementById('offerText');
const answerText = document.getElementById('answerText');
const offerInput = document.getElementById('offerInput');
const copyOfferBtn = document.getElementById('copyOfferBtn');
const copyAnswerBtn = document.getElementById('copyAnswerBtn');
const copyOfferInputBtn = document.getElementById('copyOfferInputBtn');
const pasteAnswerBtn = document.getElementById('pasteAnswerBtn');
const pasteOfferInputBtn = document.getElementById('pasteOfferInputBtn');
const setAnswerBtn = document.getElementById('setAnswerBtn');
const answerBtn = document.getElementById('answerBtn');
const cameraStatus = document.getElementById('cameraStatus');
const connectionStatus = document.getElementById('connectionStatus');
const iceStatus = document.getElementById('iceStatus');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const chatMessages = document.getElementById('chatMessages');

// Debug: Check if critical elements exist
if (!chatMessages) {
    console.error('Critical error: chatMessages element not found');
}
if (!messageInput) {
    console.error('Critical error: messageInput element not found');
}
if (!sendMessageBtn) {
    console.error('Critical error: sendMessageBtn element not found');
}

// --- State ---
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isAudioMuted = false;
let isVideoDisabled = false;
let dataChannel; // Declare dataChannel in a broader scope

// --- WebRTC Config ---
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- UI Event Bindings ---
startBtn.addEventListener('click', startCamera);
callBtn.addEventListener('click', createCall);
hangupBtn.addEventListener('click', hangUp);
muteBtn.addEventListener('click', toggleAudio);
videoBtn.addEventListener('click', toggleVideo);
copyOfferBtn.addEventListener('click', copyOffer);
copyAnswerBtn.addEventListener('click', copyAnswer);
copyOfferInputBtn.addEventListener('click', copyOfferInput);
pasteAnswerBtn.addEventListener('click', pasteAnswer);
pasteOfferInputBtn.addEventListener('click', pasteOfferInput);
setAnswerBtn.addEventListener('click', setAnswer);
answerBtn.addEventListener('click', answerCall);
sendMessageBtn.addEventListener('click', sendMessage);

// Add Enter key support for sending messages
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !messageInput.disabled) {
        sendMessage();
    }
});

// --- UI Functions ---
function updateStatus(elementId, status) {
    const element = document.getElementById(elementId);
    element.className = 'status-indicator';
    if (status === 'connected') {
        element.classList.add('connected');
    } else if (status === 'connecting') {
        element.classList.add('connecting');
    }
}

function updateConnectionStatus() {
    if (!peerConnection) return;
    const state = peerConnection.connectionState;
    switch (state) {
        case 'connected':
            updateStatus('connectionStatus', 'connected');
            messageInput.disabled = false; // Enable chat input
            sendMessageBtn.disabled = false; // Enable send button
            break;
        case 'connecting':
        case 'new':
            updateStatus('connectionStatus', 'connecting');
            break;
        default:
            updateStatus('connectionStatus', 'disconnected');
    }
}

function updateIceStatus() {
    if (!peerConnection) return;
    const state = peerConnection.iceConnectionState;
    switch (state) {
        case 'connected':
        case 'completed':
            updateStatus('iceStatus', 'connected');
            break;
        case 'checking':
        case 'new':
            updateStatus('iceStatus', 'connecting');
            break;
        default:
            updateStatus('iceStatus', 'disconnected');
    }
}

function addMessageToChat(message, isLocal = false) {
    if (!chatMessages) {
        console.error('chatMessages element not found');
        return;
    }
    const messageElement = document.createElement('div');
    messageElement.className = isLocal ? 'message local' : 'message remote';
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Camera & Media ---
async function startCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: true
        });
        localVideo.srcObject = localStream;
        startBtn.disabled = true;
        callBtn.disabled = false;
        muteBtn.disabled = false;
        videoBtn.disabled = false;
        updateStatus('cameraStatus', 'connected');
    } catch (error) {
        alert('Could not access camera and microphone. Please check permissions.');
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isAudioMuted = !isAudioMuted;
            audioTrack.enabled = !isAudioMuted;
            muteBtn.textContent = isAudioMuted ? 'Unmute Audio' : 'Mute Audio';
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            isVideoDisabled = !isVideoDisabled;
            videoTrack.enabled = !isVideoDisabled;
            videoBtn.textContent = isVideoDisabled ? 'Enable Video' : 'Disable Video';
        }
    }
}

// --- WebRTC Core ---
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
    peerConnection.ontrack = event => {
        if (event.streams && event.streams[0]) {
            remoteStream = event.streams[0];
            remoteVideo.srcObject = remoteStream;
        }
    };
    peerConnection.onicecandidate = event => {
        // ICE candidates are included in offer/answer
    };
    peerConnection.onconnectionstatechange = updateConnectionStatus;
    peerConnection.oniceconnectionstatechange = updateIceStatus;

    // Handle incoming data channels (for the answerer)
    peerConnection.ondatachannel = (event) => {
        const channel = event.channel;
        setupDataChannel(channel);
    };

    // Create a data channel for messaging (for the caller)
    dataChannel = peerConnection.createDataChannel("chat");
    setupDataChannel(dataChannel);

    updateStatus('connectionStatus', 'connecting');
}

// Helper function to setup data channel handlers
function setupDataChannel(channel) {
    dataChannel = channel; // Store reference to the channel
    
    dataChannel.onopen = () => {
        console.log('Data channel opened');
        messageInput.disabled = false; // Enable chat input
        sendMessageBtn.disabled = false; // Enable send button
    };

    dataChannel.onclose = () => {
        console.log('Data channel closed');
        messageInput.disabled = true; // Disable chat input
        sendMessageBtn.disabled = true; // Disable send button
    };

    dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
    };

    dataChannel.onmessage = (event) => {
        console.log('Received message:', event.data);
        addMessageToChat(event.data, false); // Display incoming messages (not local)
    };
}

async function createCall() {
    if (!localStream) {
        alert('You must start the camera before creating a call.');
        return;
    }
    createPeerConnection();
    try {
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        await peerConnection.setLocalDescription(offer);
        await waitForIceGathering();
        offerText.value = JSON.stringify(peerConnection.localDescription, null, 2);
        copyOfferBtn.disabled = false;
        callBtn.disabled = true;
        hangupBtn.disabled = false;
    } catch (error) {
        alert('Error creating call: ' + error.message);
    }
}

async function answerCall() {
    try {
        const offerData = JSON.parse(offerInput.value.trim());
        createPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offerData));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await waitForIceGathering();
        answerText.value = JSON.stringify(peerConnection.localDescription, null, 2);
        callBtn.disabled = true;
        hangupBtn.disabled = false;
        answerBtn.disabled = true;
        offerInput.value = '';
    } catch (error) {
        alert('Error answering call. Please check the offer format.');
    }
}

async function setAnswer() {
    try {
        const answerData = JSON.parse(answerText.value.trim());
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData));
        setAnswerBtn.disabled = true;
        answerText.value = '';
    } catch (error) {
        alert('Error setting answer. Please check the answer format.');
    }
}

function hangUp() {
    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteStream) {
        remoteStream = null;
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    startBtn.disabled = false;
    callBtn.disabled = true;
    hangupBtn.disabled = true;
    muteBtn.disabled = true;
    videoBtn.disabled = true;
    copyOfferBtn.disabled = true;
    messageInput.disabled = true;
    sendMessageBtn.disabled = true;
    setAnswerBtn.disabled = false;
    answerBtn.disabled = false;
    offerText.value = '';
    answerText.value = '';
    offerInput.value = '';
    muteBtn.textContent = 'Mute Audio';
    videoBtn.textContent = 'Disable Video';
    copyOfferBtn.textContent = 'Copy Offer';
    isAudioMuted = false;
    isVideoDisabled = false;
    updateStatus('cameraStatus', 'disconnected');
    updateStatus('connectionStatus', 'disconnected');
    updateStatus('iceStatus', 'disconnected');
}

// --- Signaling & Utilities ---
function waitForIceGathering() {
    return new Promise(resolve => {
        if (peerConnection.iceGatheringState === 'complete') {
            resolve();
        } else {
            let resolved = false;
            const finish = () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };
            peerConnection.addEventListener('icegatheringstatechange', () => {
                if (peerConnection.iceGatheringState === 'complete') {
                    finish();
                }
            });
            setTimeout(() => {
                finish();
            }, 3000);
        }
    });
}

// Enhanced clipboard functions with better cross-platform support
async function copyToClipboard(text, buttonElement, successText, defaultText) {
    try {
        // Check if clipboard API is available
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            buttonElement.textContent = successText;
            setTimeout(() => {
                buttonElement.textContent = defaultText;
            }, 2000);
        } else {
            throw new Error('Clipboard API not available');
        }
    } catch (error) {
        // Fallback for older browsers or insecure contexts
        try {
            // Create a temporary textarea element
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            // Try to copy using execCommand
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                buttonElement.textContent = successText;
                setTimeout(() => {
                    buttonElement.textContent = defaultText;
                }, 2000);
            } else {
                throw new Error('Copy failed');
            }
        } catch (fallbackError) {
            // Final fallback - show text for manual copy
            alert(`Copy failed. Please manually copy this text:\n\n${text}`);
            buttonElement.textContent = 'Copy Failed';
            setTimeout(() => {
                buttonElement.textContent = defaultText;
            }, 3000);
        }
    }
}

async function pasteFromClipboard(targetElement, buttonElement, successText, defaultText) {
    try {
        // Check if clipboard API is available
        if (navigator.clipboard && window.isSecureContext) {
            const text = await navigator.clipboard.readText();
            targetElement.value = text;
            buttonElement.textContent = successText;
            setTimeout(() => {
                buttonElement.textContent = defaultText;
            }, 2000);
        } else {
            throw new Error('Clipboard API not available');
        }
    } catch (error) {
        // Fallback for older browsers or mobile
        targetElement.focus();
        targetElement.select();
        
        // Show instructions based on platform
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        
        let instruction;
        if (isMobile) {
            instruction = 'Tap and hold, then select "Paste"';
        } else if (isMac) {
            instruction = 'Press Cmd+V to paste';
        } else {
            instruction = 'Press Ctrl+V to paste';
        }
        
        buttonElement.textContent = instruction;
        setTimeout(() => {
            buttonElement.textContent = defaultText;
        }, 4000);
    }
}

async function copyOffer() {
    if (!offerText.value.trim()) {
        alert('Offer textarea is empty. Nothing to copy.');
        return;
    }
    await copyToClipboard(offerText.value, copyOfferBtn, 'Copied!', 'Copy Offer');
}

async function copyAnswer() {
    if (!answerText.value.trim()) {
        alert('Answer textarea is empty. Nothing to copy.');
        return;
    }
    await copyToClipboard(answerText.value, copyAnswerBtn, 'Copied!', 'Copy Answer');
}

async function copyOfferInput() {
    if (!offerInput.value.trim()) {
        alert('Offer input textarea is empty. Nothing to copy.');
        return;
    }
    await copyToClipboard(offerInput.value, copyOfferInputBtn, 'Copied!', 'Copy Offer');
}

async function pasteAnswer() {
    await pasteFromClipboard(answerText, pasteAnswerBtn, 'Pasted!', 'Paste Answer');
}

async function pasteOfferInput() {
    await pasteFromClipboard(offerInput, pasteOfferInputBtn, 'Pasted!', 'Paste Offer');
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message !== '') {
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                // Send message to the other peer via data channel
                dataChannel.send(message);
                console.log('Sent message:', message);
                addMessageToChat(message, true); // Display the message in the chat (sent)
            } catch (error) {
                console.error('Failed to send message:', error);
                addMessageToChat("Failed to send message", false);
            }
        } else {
            console.log('Data channel not ready. State:', dataChannel ? dataChannel.readyState : 'null');
            // For testing purposes or when no peer connection exists
            addMessageToChat(message, true); // Display the message locally
            addMessageToChat("(No peer connected - message sent locally only)", false);
        }
        messageInput.value = ''; // Clear the input field
    }
}

// --- Init Status ---
updateStatus('cameraStatus', 'disconnected');
updateStatus('connectionStatus', 'disconnected');
updateStatus('iceStatus', 'disconnected');

// Display the build number on the frontend
const buildNumber = document.querySelector('meta[name="build-number"]').content;
document.getElementById('buildNumberDisplay').innerText = 'Build Number: ' + buildNumber;

console.log('WebRTC Modular LAN Demo loaded');
