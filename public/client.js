// get the references for elements
var form = document.querySelector("#form"),
  dashboard = document.querySelector("#dashboard"),
  stream = document.querySelector("#stream"),
  roomsList = document.querySelector("#roomsList"),
  client = document.querySelector("#client"),
  guest = document.querySelector("#guest"),
  hangUp = document.querySelector("#hang-up"),
  connectRoom = document.querySelector("#connect-room"),
  connect = document.querySelector("#connect");

// Hard-coded link to your MP4 file
const videoFilePath = "video_example.mp4"; // Replace with the actual path to your MP4 file

const iceServers = {
  iceServer: {
    urls: "stun:stun.l.google.com:19302"
  }
};

const pc = new RTCPeerConnection(iceServers);
const socket = io();

var rooms = [];
var inboundStream = null;
var localeStream, currentRoom;

form.onsubmit = function (e) {
  e.preventDefault();
  var val = e.target[0].value;
  socket.emit("room", val);
};

hangUp.onclick = function (e) {
  location.reload();
};

connect.onclick = function () {
  currentRoom = connectRoom.value;
  if (!rooms.includes(currentRoom)) {
    alert("There is no room with a given name");
    return;
  }

  // Create a video element and set the source to the MP4 file
  const videoFile = document.createElement("video");
  videoFile.src = videoFilePath; // Hard-coded link to your MP4 file
  videoFile.controls = true; // Optional: add controls for the video
  videoFile.style.display = "none"; // Hide the video element

  document.body.appendChild(videoFile); // Append the video element to the body

  // Play the video file
  videoFile.play().then(() => {
    // Create a MediaStream from the video element
    const stream = videoFile.captureStream(); // Use captureStream to get the media stream
    client.srcObject = stream; // Set the local video element's source to the stream
    localeStream = stream; // Store the stream for WebRTC connection

    // Add tracks to the peer connection
    localeStream.getTracks().forEach(track => {
      pc.addTrack(track, localeStream);
    });

    socket.emit("join", currentRoom); // Join the room
  }).catch(err => {
    console.error("Error playing video:", err);
  });

  dashboard.style.display = "none";
  stream.style.display = "block";
};

socket.on("room", room => {
  rooms.push(room);
  var li = document.createElement("li");
  li.innerText = room;
  roomsList.append(li);
});

socket.on("join", room => {
  if (currentRoom !== room) return;

  pc.ontrack = addRemoteMediaStream;
  pc.onicecandidate = generateIceCandidate;
  pc.createOffer().then(description => {
    pc.setLocalDescription(description);
    console.log("Setting locale description:", description);
    socket.emit("offer", description);
  });
});

socket.on("offer", offer => {
  pc.ontrack = addRemoteMediaStream;
  pc.onicecandidate = generateIceCandidate;
  pc.setRemoteDescription(new RTCSessionDescription(offer));
  pc.createAnswer().then(description => {
    pc.setLocalDescription(description);
    console.log("Setting locale description", description);
    socket.emit("answer", description);
  });
});

socket.on("answer", answer => {
  pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", event => {
  var iceCandidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate
  });
  pc.addIceCandidate(iceCandidate);
});

function addRemoteMediaStream(event) {
  if (event.streams && event.streams[0]) {
    guest.srcObject = event.streams[0];
  } else {
    if (!inboundStream) {
      inboundStream = new MediaStream();
      guest.srcObject = inboundStream;
    }
    inboundStream.addTrack(event.track);
  }
}

function generateIceCandidate(event) {
  if (event.candidate) {
    var candidate = {
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    };
    console.log("Sending a candidate: ", candidate);
    socket.emit("candidate", candidate);
  }
}
