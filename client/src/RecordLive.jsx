import React, { useState, useEffect, useRef } from "react";

// import { useLocation } from "react-router-dom";

const RecordLive = () => {
  // const location = useLocation();
  const userVideo = useRef();
  const userStream = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const webSocketRef = useRef();

  const openCamera = async () => {
    const constraints = {
      video: true,
      audio: true,
    };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      userVideo.current.srcObject = stream;
      userStream.current = stream;
    });
  };
  useEffect(() => {
    openCamera().then(async () => {
      // const roomID = location.pathname.split("/");
      webSocketRef.current = new WebSocket(
        `wss://owino-backend-go.onrender.com/ws`
      );

      await webSocketRef.current.addEventListener("open", () => {
        webSocketRef.current.send(JSON.stringify({ join: true }));
      });

      await webSocketRef.current.addEventListener("message", async (e) => {
        const message = JSON.parse(e.data);

        if (message.join) {
          callUser();
        }

        if (message.offer) {
          handleOffer(message.offer);
        }

        if (message.answer) {
          console.log("Receiving Answer");
          peerRef.current.setRemoteDescription(
            new RTCSessionDescription(message.answer)
          );
        }

        if (message.iceCandidate) {
          console.log("Receiving and Adding ICE Candidate");
          try {
            await peerRef.current.addIceCandidate(message.iceCandidate);
          } catch (err) {
            console.log("error ICE CANDIDADE");
          }
        }
      });
    });
  });

  const handleOffer = async (offer) => {
    console.log("Received Offer, Creating Answer");
    peerRef.current = createPeer();

    await peerRef.current.setRemoteDescription(
      new RTCSessionDescription(offer)
    );
    console.log(
      "remote description protocol",
      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      )
    );

    await userStream.current.getTracks().forEach((track) => {
      peerRef.current.addTrack(track, userStream.current);
    });

    const answer = await peerRef.current.createAnswer();
    const localSDP = await peerRef.current.setLocalDescription(answer);
    console.log("local sdp", localSDP);
    console.log("local description protocol", answer);

    await webSocketRef.current.send(
      JSON.stringify({ answer: peerRef.current.localDescription })
    );
  };

  const callUser = async () => {
    console.log("Calling Other User");
    peerRef.current = createPeer();

    await userStream.current.getTracks().forEach(async (track) => {
      await peerRef.current.addTrack(track, userStream.current);
    });
  };

  const createPeer = () => {
    console.log("Creating Peer Connection");
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.onnegotiationneeded = handleNegotiationNeeded;
    peer.onicecandidate = handleIceCandidateEvent;
    peer.ontrack = handleTrackEvent;

    return peer;
  };

  const handleNegotiationNeeded = async () => {
    console.log("Creating Offer");

    try {
      const myOffer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(myOffer);

      await webSocketRef.current.send(
        JSON.stringify({ offer: peerRef.current.localDescription })
      );
    } catch (err) {}
  };

  const handleIceCandidateEvent = async (e) => {
    console.log("Found Ice Candidate");
    if (e.candidate) {
      console.log(e.candidate);
      await webSocketRef.current.send(
        JSON.stringify({ iceCandidate: e.candidate })
      );
    }
  };

  const handleTrackEvent = (e) => {
    console.log("Received Tracks");
    console.log(e.streams);
    partnerVideo.current.srcObject = e.streams[0];
  };

  return (
    <div>
      <h1>RecordLive</h1>

      <div>
        <video
          playsInline
          autoPlay
          muted
          controls={true}
          ref={userVideo}
          width="160"
          height="120"
        />
        <video
          playsInline
          autoPlay
          controls={true}
          ref={partnerVideo}
          width="160"
          height="120"
        />
      </div>
    </div>
  );
};

export default RecordLive;
