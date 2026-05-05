const handleBuy = async (songId: number) => {
  try {
    // 1. Hit the Live Oscillator
    const response = await fetch('https://aitify-oscillator.onrender.com/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: songId })
    });
    
    const data = await response.json();
    
    if (data.status === "TRADED") {
      console.log(`Trade Success: ${data.song}`);
      
      // 2. Feed the signed URL from Firebase into the Global Radio Player
      const audioPlayer = document.getElementById('global-radio-player') as HTMLAudioElement;
      if (audioPlayer) {
        audioPlayer.src = data.stream_url;
        audioPlayer.play();
      }
    }
  } catch (error) {
    console.error("Trade Engine Error:", error);
  }
};
