function KeepAlive() {
  setInterval(() => {
    fetch('https://khabiteq-realty.onrender.com')
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to keep alive:', response.statusText);
        }
      })
      .catch((error) => {
        console.error('Error keeping alive:', error);
      });
  }, 5 * 60 * 1000); // Keep alive every 5 minutes
}

export default KeepAlive;
