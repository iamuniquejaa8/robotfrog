"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, AppBar, Toolbar } from '@mui/material';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { createFFmpeg, fetchFile} from '@ffmpeg/ffmpeg';

const VoiceToText = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [pauseToggle, setPauseToggle] = useState(false);
  const [audioBlob, setAudioBlob]= useState(null);// to store the text 

  const isPausedRef = useRef(false);
  const connectionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]); // FOR STORING AUDIO CHUNKS

  useEffect(() => {
    return () => {
      stopListening(); // Cleanup on component unmount
    };
  }, []);

  const startListening = async () => {
    try {
      console.log('Requesting microphone access...');
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted.');

      const deepgram = createClient("7ba89584169bea60898c8463004c92fe435e0aca");

      connectionRef.current = deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
      });

      connectionRef.current.addListener(LiveTranscriptionEvents.Open, () => {
        console.log('Connection opened.');

        connectionRef.current.addListener(LiveTranscriptionEvents.Close, () => {
          console.log('Connection closed.');
        });

        connectionRef.current.addListener(LiveTranscriptionEvents.Transcript, (data) => {
          if (!isPausedRef.current) {
            console.log(isPausedRef.current);
            const receivedTranscript = data.channel.alternatives[0].transcript;
            console.log('Received transcript:', receivedTranscript);
            setTranscript((prevTranscript) => prevTranscript + ' ' + receivedTranscript);
          }
        });

        connectionRef.current.addListener(LiveTranscriptionEvents.Error, (err) => {
          console.error('Deepgram error:', err);
        });

        startMediaRecorder();
      });

      setIsListening(true);
      isPausedRef.current = false;
      setPauseToggle((prev) => !prev); // Trigger a re-render
    } catch (error) {
      console.error('Error in startListening:', error);
    }
  };

  const startMediaRecorder = () => {
    mediaRecorderRef.current = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data); // for stroing audio chunks 
        connectionRef.current.send(event.data);
        
      }
    };
    mediaRecorderRef.current.start(10);
  };

  const pauseListening = () => {
    console.log('Pausing transcription...');
    if (isPausedRef.current) {
      console.log('Resumed...');
      isPausedRef.current = false;
    } else {
      console.log('Paused...');
      isPausedRef.current = true;
    }
    setPauseToggle((prev) => !prev); // Trigger a re-render
  };

  const stopListening = async() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      console.log('MediaRecorder stopped.');
    }
    if (connectionRef.current) {
      connectionRef.current.finish();
      console.log('Deepgram connection finished.');
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
    isPausedRef.current = false;
    setPauseToggle((prev) => !prev);
    setTranscript('');
    console.log('Transcript cleared.');

  
     const audioBlob = new Blob(audioChunksRef.current, { type:  "audio/mpeg" });
    setAudioBlob(audioBlob);
    await convertToMp3(audioBlob);
  };

  const convertToMp3=  async(audioBlob)=>{
    const  ffmpeg=createFFmpeg({log: true});
    await ffmpeg.load();

    const audioFile= new File([audioBlob], "recording.webm");
    ffmpeg.FS("writefile", "recording.webm", await fetchFile(audioFile));
  
    await ffmpeg.run("-i","recoding.webm","output.mp3");

    const mp3Data=ffmpeg.FS("readFile", "output.mp3");

    const mp3Blob = new Blob([mp3Data.buffer], { type:  "audio/mpeg" });

    const mp3BlobData=URL.createObjectURL(mp3Blob);
    console.log(mp3BlobData);
    
    console.log(audioChunksRef);

  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Real-time Voice to Text
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Typography variant="body1">
          {transcript || 'Transcript will appear here...'}
        </Typography>
      </Box>
      <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={startListening}
          disabled={isListening}
          sx={{ mr: 1 }}
        >
          Start
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={pauseListening}
          disabled={!isListening}
          sx={{ mr: 1 }}
        >
          {isPausedRef.current ? 'Resume' : 'Pause'}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={stopListening}
          disabled={!isListening}
        >
          Stop
        </Button>
      </Box>
    </Box>
  );
};

export default VoiceToText;
