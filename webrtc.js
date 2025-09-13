// webrtc.js - Modular WebRTC LAN Demo

// --- UI Elements ---
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
const setAnswerBtn = document.getElementById('setAnswerBtn');
const answerBtn = document.getElementById('answerBtn');
const cameraStatus = document.getElementById('cameraStatus');
const connectionStatus = document.getElementById('connectionStatus');
const iceStatus = document.getElementById('iceStatus');

// --- State ---
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let isAudioMuted = false;
let isVideoDisabled = false;

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
setAnswerBtn.addEventListener('click', setAnswer);
answerBtn.addEventListener('click', answerCall);

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
    updateStatus('connectionStatus', 'connecting');
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

async function copyOffer() {
    try {
        await navigator.clipboard.writeText(offerText.value);
        copyOfferBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyOfferBtn.textContent = 'Copy Offer';
        }, 2000);
    } catch (error) {
        offerText.select();
        document.execCommand('copy');
    }
}

// --- Init Status ---
updateStatus('cameraStatus', 'disconnected');
updateStatus('connectionStatus', 'disconnected');
updateStatus('iceStatus', 'disconnected');

console.log('WebRTC Modular LAN Demo loaded');
