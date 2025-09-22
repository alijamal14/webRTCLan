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
const callCodeText = document.getElementById('callCodeText');
const joinCodeInput = document.getElementById('joinCodeInput');
const copyCallCodeBtn = document.getElementById('copyCallCodeBtn');
const pasteJoinCodeBtn = document.getElementById('pasteJoinCodeBtn');
const joinCallBtn = document.getElementById('joinCallBtn');
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
if (!callCodeText) {
    console.error('Critical error: callCodeText element not found');
}
if (!copyCallCodeBtn) {
    console.error('Critical error: copyCallCodeBtn element not found');
}
if (!joinCodeInput) {
    console.error('Critical error: joinCodeInput element not found');
}
if (!pasteJoinCodeBtn) {
    console.error('Critical error: pasteJoinCodeBtn element not found');
}
if (!joinCallBtn) {
    console.error('Critical error: joinCallBtn element not found');
}

// --- State ---
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isAudioMuted = false;
let isVideoDisabled = false;
let dataChannel; // Declare dataChannel in a broader scope
let isAnswerer = false; // Track if this peer is answering a call

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
copyCallCodeBtn.addEventListener('click', copyCallCode);
pasteJoinCodeBtn.addEventListener('click', pasteJoinCode);
joinCallBtn.addEventListener('click', joinCall);
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
        console.log('Requesting camera and microphone access...');
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: true
        });
        console.log('Camera and microphone access granted successfully');
        localVideo.srcObject = localStream;
        startBtn.disabled = true;
        callBtn.disabled = false;
        muteBtn.disabled = false;
        videoBtn.disabled = false;
        updateStatus('cameraStatus', 'connected');
        console.log('Camera started successfully');
    } catch (error) {
        console.error('Camera error:', error);
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
        
        // Create a call code that contains the offer and indicates this peer is the caller
        const callCode = {
            type: 'offer',
            data: peerConnection.localDescription,
            timestamp: Date.now()
        };
        
        callCodeText.value = JSON.stringify(callCode, null, 2);
        copyCallCodeBtn.disabled = false;
        callBtn.disabled = true;
        hangupBtn.disabled = false;
        
        // Auto-copy the call code for convenience
        await copyCallCode();
        
        // Update UI to show we're waiting for someone to join
        callCodeText.placeholder = "Waiting for someone to join your call...";
        
    } catch (error) {
        alert('Error creating call: ' + error.message);
    }
}

async function joinCall() {
    try {
        const callCode = joinCodeInput.value.trim();
        if (!callCode) {
            alert('Please paste a call code first.');
            return;
        }
        
        let callData;
        try {
            callData = JSON.parse(callCode);
        } catch (e) {
            alert('Invalid call code format. Please check and try again.');
            return;
        }
        
        if (callData.type === 'offer') {
            // This is an offer, so we need to answer it
            isAnswerer = true;
            createPeerConnection();
            await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.data));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await waitForIceGathering();
            
            // Create answer code for the caller to use
            const answerCode = {
                type: 'answer',
                data: peerConnection.localDescription,
                timestamp: Date.now()
            };
            
            // Put the answer code in the input field so user can copy it
            joinCodeInput.value = JSON.stringify(answerCode, null, 2);
            
            callBtn.disabled = true;
            hangupBtn.disabled = false;
            joinCallBtn.disabled = true;
            
            alert('Call joined! Copy the answer code from the text field and send it back to the caller.');
            
        } else if (callData.type === 'answer') {
            // This is an answer to our call
            if (!peerConnection || peerConnection.signalingState === 'closed') {
                alert('No active call to receive this answer. Please create a call first.');
                return;
            }
            
            await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.data));
            joinCodeInput.value = '';
            alert('Answer received! Connection should be established shortly.');
        } else {
            alert('Unknown call code type. Please check the code and try again.');
        }
        
    } catch (error) {
        alert('Error processing call code: ' + error.message);
        console.error('Join call error:', error);
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
    copyCallCodeBtn.disabled = true;
    messageInput.disabled = true;
    sendMessageBtn.disabled = true;
    joinCallBtn.disabled = false;
    callCodeText.value = '';
    joinCodeInput.value = '';
    muteBtn.textContent = 'Mute Audio';
    videoBtn.textContent = 'Disable Video';
    copyCallCodeBtn.textContent = '📋 Copy Call Code';
    isAudioMuted = false;
    isVideoDisabled = false;
    isAnswerer = false;
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

async function copyCallCode() {
    if (!callCodeText.value.trim()) {
        alert('Call code is empty. Create a call first.');
        return;
    }
    await copyToClipboard(callCodeText.value, copyCallCodeBtn, '✅ Copied!', '📋 Copy Call Code');
}

async function pasteJoinCode() {
    await pasteFromClipboard(joinCodeInput, pasteJoinCodeBtn, '✅ Pasted!', '📋 Paste');
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
