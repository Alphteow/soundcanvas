function showView(view) {
    const views = document.querySelectorAll('.tab-content');
    views.forEach(v => v.style.display = 'none');
    document.getElementById(view).style.display = 'block';

    // Show the selected tab pane
    const selectedPane = document.getElementById(view);
    if (selectedPane) {
        selectedPane.classList.add('active');
    
        // Load content for the selected view
        switch(view) {
            case 'playlists':
                fetchPlaylists();
                break;
            case 'top-tracks':
                fetchTopTracks();
                break;
            case 'top-artists':
                fetchTopArtists();
                break;
        }
    }
}

function fetchPlaylists() {
    fetch('/api/user-playlists')
        .then(response => response.json())
        .then(playlists => {
            const playlistList = document.getElementById('playlist-list');
            playlistList.innerHTML = '';
            playlists.forEach(playlist => {
                const li = document.createElement('li');
                li.className = 'd-flex justify-content-between align-items-center mb-3';
                li.style.border = 'none'; // Remove border
                li.style.background = 'transparent'; // Remove background
                li.innerHTML = `
                    <span>${playlist.name}</span>
                    <button style="min-width: 120px; white-space: nowrap;" class="btn btn-info me-1 mb-0 btn-sm" onclick="generateImageFromPlaylist('${playlist.id}', '${playlist.name}')">Generate Image</button>
                `;
                playlistList.appendChild(li);
            });
        })
        .catch(error => console.error('Error fetching playlists:', error));
}


function fetchTopTracks() {
    fetch('/api/user-top-tracks')
        .then(response => response.json())
        .then(tracks => {
            const topTracksList = document.getElementById('top-tracks-list');
            topTracksList.innerHTML = '';
            tracks.forEach(track => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${track.name} by ${track.artists[0].name}</span>
                    <button onclick="generateImageFromTrack('${track.name}', '${track.artists[0].name}')">Generate Image</button>
                `;
                topTracksList.appendChild(li);
            });
        })
        .catch(error => console.error('Error fetching top tracks:', error));
}

function fetchTopArtists() {
    fetch('/api/user-top-artists')
        .then(response => response.json())
        .then(artists => {
            const topArtistsList = document.getElementById('top-artists-list');
            topArtistsList.innerHTML = '';
            artists.forEach(artist => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${artist.name}</span>
                    <button onclick="generateImageFromArtist('${artist.name}')">Generate Image</button>
                `;
                topArtistsList.appendChild(li);
            });
        })
        .catch(error => console.error('Error fetching top artists:', error));
}

function generateImageFromPlaylist(playlistId, playlistName) {
    console.log('Generating image for playlist:', playlistName);
    document.getElementById('loading-overlay').style.display = 'flex';

    fetch('/generate-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playlistId, playlistName }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Data received:', data);
        document.getElementById('loading-overlay').style.display = 'none';

        if (data.error) {
            throw new Error(data.error);
        }
        
        const generatedImageDiv = document.getElementById('generated-image');
        // document.getElementById('prompt').textContent = `Prompt: ${data.prompt}`;

        // Create a canvas element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Create an image element
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Handle CORS if necessary
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the image on the canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Set up the watermark text
            const watermarkText = 'SoundCanvas';
            const fontSize = Math.min(canvas.width, canvas.height) / 10; // Adjust the font size relative to the image size
            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; // Semi-transparent white

            // Calculate the text width and height
            const textWidth = ctx.measureText(watermarkText).width;
            const textHeight = fontSize;

            // Loop to fill the canvas with the watermark text
            for (let y = 0; y < canvas.height; y += textHeight + 50) { // 50 is the vertical spacing
                for (let x = 0; x < canvas.width; x += textWidth + 50) { // 50 is the horizontal spacing
                    ctx.fillText(watermarkText, x, y);
                }
            }

            // Convert the canvas to a data URL with reduced quality
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // Adjust the quality here (0.0 to 1.0)

            // Set the src of the image element to the data URL
            const displayImg = document.getElementById('image');
            displayImg.src = dataUrl;
            displayImg.style.marginBottom = '20px'; // Add space below the image

            // Store the image URL in local storage
            localStorage.setItem('latestGeneratedImage', dataUrl);

            displayImg.onload = () => {
                // Remove flex display from generatedImageDiv
                generatedImageDiv.style.display = 'block';
                
                // Create a container for the button
                const buttonContainer = document.createElement('div');
                buttonContainer.style.textAlign = 'center'; // Center the button
                buttonContainer.style.marginTop = '20px'; // Add space above the button
    
                // Create and style the button
                const buyButton = document.createElement('button');
                buyButton.textContent = 'Buy HD Image';
                buyButton.style.maxWidth = 'fit-content';
                buyButton.style.whiteSpace = 'nowrap';
                buyButton.className = 'btn bg-gradient-success w-auto me-1 mb-0';
                buyButton.onclick = () => initiateStripeCheckout(data.hdImageUrl, data.imageUrlId);

                // Add the button to the container
                buttonContainer.appendChild(buyButton);
                
                // Clear any existing buttons
                const existingButton = generatedImageDiv.querySelector('button');
                if (existingButton) {
                    existingButton.remove();
                }

                // Add the button container to the generatedImageDiv
                generatedImageDiv.appendChild(buttonContainer);

                console.log('Image loaded successfully');
                generatedImageDiv.scrollIntoView({ behavior: 'smooth' });

                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('payment_success') === 'true') {
                    alert('Payment successful! Your HD image is being downloaded.');
                    window.history.replaceState({}, document.title, '/');
                }
            };
        };
        img.onerror = () => {
            console.error('Failed to load image');
            alert('Failed to load generated image. Please try again.');
        };
        img.src = data.imageUrl;
    })
    .catch(error => {
        document.getElementById('loading-overlay').style.display = 'none';
        console.error('Error:', error);
        alert('Failed to generate image. Please try again.');
    });
}

function initiateStripeCheckout(hdImageUrl, imageUrlId) {
    fetch('/config')
    .then(response => response.json())
    .then(config => {
        const stripe = Stripe(config.stripePublishableKey);

        // Proceed with your Stripe checkout logic
        fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hdImageUrl, imageUrlId })
        })
        .then((response) => response.json())
        .then((session) => {
            return stripe.redirectToCheckout({ sessionId: session.id });
        })
        .then((result) => {
            if (result.error) {
                alert(result.error.message);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    });
}



function generateImageFromTrack(trackName, artistName) {
    generateImage(`${trackName} by ${artistName}`);
}

function generateImageFromArtist(artistName) {
    generateImage(artistName);
}

function generateImage(prompt) {
    fetch('/generate-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playlistName: prompt }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        const generatedImageDiv = document.getElementById('generated-image');
        // document.getElementById('prompt').textContent = `Prompt: ${data.prompt}`;
        const img = document.getElementById('image');
        img.src = data.imageUrl;
        img.onload = () => {
            generatedImageDiv.style.display = 'block';
        };
        img.onerror = () => {
            console.error('Failed to load image');
            alert('Failed to load generated image. Please try again.');
        };
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to generate image. Please try again.');
    });
}

function loginAsDifferentUser() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            localStorage.removeItem('spotifyAuthToken');
            sessionStorage.clear();
            window.location.href = '/auth/spotify?show_dialog=true';
        })
        .catch(error => console.error('Error logging out:', error));
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            // Clear local storage
            localStorage.removeItem('latestGeneratedImage');
            localStorage.removeItem('spotifyAuthToken');
            
            // Reset UI elements
            document.getElementById('dashboard-content').style.display = 'none';
            const spotifyLoginButton = document.getElementById('spotifyLoginButton');
            spotifyLoginButton.textContent = 'Login with Spotify';
            spotifyLoginButton.disabled = false;
            spotifyLoginButton.classList.remove('bg-gradient-success');
            spotifyLoginButton.classList.add('bg-gradient-info');
            spotifyLoginButton.onclick = () => window.location.href = '/auth/spotify';
            
            // Redirect to home page
            window.location.href = '/';
        })
        .catch(error => {
            console.error('Error logging out:', error);
            alert('Error logging out. Please try again.');
        });
}

function fetchUserProfile() {
    fetch('/api/auth-status')
        .then(response => response.json())
        .then(data => {
            if (data.isAuthenticated) {
                // Show both landing and dashboard content
                document.getElementById('landing-content').style.display = 'block';
                document.getElementById('dashboard-content').style.display = 'block';
                
                // Fetch playlists for the dashboard
                fetchPlaylists();
            } else {
                // Only show landing content when not authenticated
                document.getElementById('landing-content').style.display = 'block';
                document.getElementById('dashboard-content').style.display = 'none';
            }
        })
        .catch(error => console.error('Error checking auth status:', error));
}

document.addEventListener('DOMContentLoaded', async () => {
    const latestImage = localStorage.getItem('latestGeneratedImage');
    if (latestImage) {
        document.getElementById('image').src = latestImage;
    }

    const spotifyLoginButton = document.getElementById('spotifyLoginButton');
    
    try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();

        if (data.isAuthenticated) {
            document.getElementById('landing-content').style.display = 'block';
            document.getElementById('dashboard-content').style.display = 'block';

            spotifyLoginButton.textContent = 'Logged In';
            spotifyLoginButton.disabled = true;
            spotifyLoginButton.classList.remove('bg-gradient-info');
            spotifyLoginButton.classList.add('bg-gradient-success');

            fetchPlaylists();
        } else {
            document.getElementById('landing-content').style.display = 'block';
            document.getElementById('dashboard-content').style.display = 'none';
            
            spotifyLoginButton.textContent = 'Login with Spotify';
            spotifyLoginButton.onclick = () => window.location.href = '/auth/spotify';
        }
    } catch (error) {
        console.error('Error checking authentication status:', error);
    }
});

// Make sure window.onload doesn't conflict with DOMContentLoaded
window.onload = () => {
    // Remove fetchUserProfile call since it's already handled in DOMContentLoaded
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_success') === 'true') {
        alert('Payment successful! Your HD image is being downloaded.');
        window.history.replaceState({}, document.title, '/');
    }
};