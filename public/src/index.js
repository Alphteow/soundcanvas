// src/index.js
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const Replicate = require('replicate');
require('dotenv').config();
const path = require('path');
const request = require('request'); // Add this at the top of your file
const functions = require('firebase-functions');
const app = express();
const PORT = process.env.PORT || 3000;

// const spotifyClientId = functions.config().spotify.client_id;
// const spotifyClientSecret = functions.config().spotify.client_secret;
// const stripeSecretKey = functions.config().stripe.secret_key;
// const stripePublishableKey = functions.config().stripe.publishable_key;
// const replicateApiKey = functions.config().replicate.api_key;
// const openaiApiKey = functions.config().openai.api_key; 

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.use(session({ 
    secret: 'your_secret_key', 
    resave: false, 
    saveUninitialized: false 
}));
app.use(passport.initialize());
app.use(passport.session());

const CALLBACK_URL = 'https://sound-d3d84.web.app/auth/spotify/callback'

passport.use(new SpotifyStrategy({
    clientID: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    // clientID: spotifyClientId,
    // clientSecret: spotifyClientSecret,
    callbackURL: CALLBACK_URL
},
function(accessToken, refreshToken, expires_in, profile, done) {
    return done(null, { profile, accessToken });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Replicate configuration
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_KEY
});
// const replicate = new Replicate({
//     auth: replicateApiKey,
//   });

// // Routes
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
//     // res.sendFile('public/index.html')
// });

// In index.js
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        // If user is authenticated, still serve index.html but with authenticated state
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    } else {
        // If user is not authenticated, serve regular index.html
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
});

async function fetchSpotifyToken() {
    try {
        const response = await fetch('http://localhost:3000/api/token');
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error fetching Spotify token:', error);
        throw error;
    }
}

app.get('/config', (req, res) => {
    res.json({ stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// Route to get Spotify access token using Client Credentials Flow
app.get('/api/token', async (req, res) => {
    const client_id = process.env.SPOTIFY_CLIENT_ID; // Use your Spotify Client ID
    const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Use your Spotify Client Secret

    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
        },
        form: {
            grant_type: 'client_credentials'
        },
        json: true
    };

    request.post(authOptions, function(error, response, body) {
        if (error) {
            console.error('Error fetching Spotify token:', error);
            return res.status(500).json({ error: 'Failed to fetch Spotify token' });
        }

        if (response.statusCode === 200) {
            const token = body.access_token;
            console.log('Spotify access token:', token);
            res.json({ access_token: token });
        } else {
            console.error('Failed to fetch Spotify token:', body);
            res.status(response.statusCode).json({ error: body });
        }
    });
});

app.get('/auth/spotify', (req, res, next) => {
    const showDialog = req.query.show_dialog === 'true';
    passport.authenticate('spotify', { 
        scope: ['user-read-private', 'user-read-email', 'user-top-read', 'playlist-read-private', 'playlist-read-collaborative'],
        showDialog: showDialog
    })(req, res, next);
  });



app.get('/auth/spotify/callback', 
    passport.authenticate('spotify', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/#dashboard-content');
    });

    app.get('/api/auth-status', (req, res) => {
        try {
            const isAuthenticated = req.isAuthenticated();
            console.log('Auth status:', isAuthenticated);
            res.json({ isAuthenticated: isAuthenticated });
        } catch (error) {
            console.error('Error checking authentication status:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

// app.get('/auth/spotify/callback', 
//     passport.authenticate('spotify', { failureRedirect: '/' }),
//     (req, res) => {
//         // Store the user's authentication state in the session
//         req.session.isAuthenticated = true;
//         req.session.accessToken = req.user.accessToken;
        
//         // Redirect back to the main page
//         res.redirect('/');
//     });

app.get('/api/user-profile', async (req, res) => {
    console.log('Fetching user profile...');
    try {
        const accessToken = await fetchSpotifyToken(); // Fetch the token
        console.log('Access token:', accessToken);

        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        console.log('Spotify API response status:', response.status);
        const data = await response.json();
        console.log('User profile data:', data);
        res.json(data);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});



app.get('/api/user-playlists', async (req, res) => {
    try {
        const accessToken = await fetchSpotifyToken(); // Fetch the token

        const response = await fetch('https://api.spotify.com/v1/me/playlists', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const data = await response.json();
        res.json(data.items);
    } catch (error) {
        console.error('Error fetching playlists:', error);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

app.get('/api/playlist-tracks/:playlistId', async (req, res) => {
    try {
        const accessToken = await fetchSpotifyToken(); // Fetch the token
        const playlistId = req.params.playlistId;

        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(name,artists))&limit=100`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const data = await response.json();
        const tracks = data.items.map(item => ({
            name: item.track.name,
            artist: item.track.artists[0].name,
        }));

        const firstFive = tracks.slice(0, 5);
        const lastFive = tracks.slice(-5);
        res.json({ firstFive, lastFive });
    } catch (error) {
        console.error('Error fetching playlist tracks:', error);
        res.status(500).json({ error: 'Failed to fetch playlist tracks' });
    }
});

app.get('/api/user-top-artists', async (req, res) => {
    try {
        const accessToken = await fetchSpotifyToken(); // Fetch the token

        const response = await fetch('https://api.spotify.com/v1/me/top/artists', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const data = await response.json();
        res.json(data.items);
    } catch (error) {
        console.error('Error fetching top artists:', error);
        res.status(500).json({ error: 'Failed to fetch top artists' });
    }
});


app.get('/api/user-top-tracks', async (req, res) => {
    try {
        const accessToken = await fetchSpotifyToken(); // Fetch the token

        const response = await fetch('https://api.spotify.com/v1/me/top/tracks', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const data = await response.json();
        res.json(data.items);
    } catch (error) {
        console.error('Error fetching top tracks:', error);
        res.status(500).json({ error: 'Failed to fetch top tracks' });
    }
});


const axios = require('axios'); // Add this at the top of your file

const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// const openai = new OpenAI({ apiKey: openaiApiKey });

async function generatePrompt(songList, playlistName) {
    try {
        console.log('Generating prompt with OpenAI...');
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {role: "system", content: "You are an AI assistant that generates creative image prompts based on song lists."},
                {role: "user", content: `Generate a nostalgic, sentimental, abstract image prompt based on these songs: ${songList}. The image should capture the mood and themes of these songs, which are from the playlist "${playlistName}". Add lyrics and titles.`}
            ],
        });
        console.log('OpenAI response:', chatCompletion);
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error('Error generating prompt with OpenAI:', error);
        // Fallback to a simple prompt generation method
        return `A nostalgic, sentimental, abstract representation of the playlist "${playlistName}" featuring elements from ${songList}. Lyrics and titles should be added in the prompt. No vulgarities as well. Prompt should be a paragraph`;
    }
}


app.post('/generate-image', ensureAuthenticated, async (req, res) => {
    const { playlistId, playlistName } = req.body;
    console.log('Received request to generate image for playlist:', playlistName);

    try {
        console.log('Fetching playlist tracks...');
        // const tracksResponse = await axios.get(`http://localhost:${PORT}/api/playlist-tracks/${playlistId}`, {
        const tracksResponse = await axios.get(`https://sound-d3d84.web.app/api/playlist-tracks/${playlistId}`, {
            headers: { 'Cookie': req.headers.cookie }
        });
        const { firstFive, lastFive } = tracksResponse.data;

        const songList = firstFive.concat(lastFive).map(t => `${t.name} by ${t.artist}`).join(', ');
        console.log('Song list:', songList);

        console.log('Generating prompt...');
        const generatedPrompt = await generatePrompt(songList, playlistName);
        console.log('Generated prompt:', generatedPrompt);

        // myown_prompt = "An image depicting the agricultural supply chain in India and Africa, highlighting inefficiencies and corruption. An image showing the transformation of traditional agricultural practices through blockchain technology. An image illustrating tamper-proof records and smart contracts ensuring fair compensation and consumer safety."

        console.log('Generating image...');
        const input = {
            prompt: generatedPrompt,
            go_fast: true,
            num_outputs: 1,
            aspect_ratio: "1:1",
            output_format: "webp",
            output_quality: 80
        };
        
        const output = await replicate.run("black-forest-labs/flux-pro", { input }); //If use schnell, need to change output to output[0]  
        console.log('Image generation output:', output);
    
        // if (!output || output.length === 0) {
        //     throw new Error('No image URL returned from Replicate');
        // }

  
        // Store the hdImageUrl in Firestore
        const imageUrlRef = db.collection('imageUrls').doc();
        await imageUrlRef.set({
        userId: req.user.id,
        hdImageUrl: output,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log('Sending response with image URL:', output);
        res.json({ imageUrl: output, prompt: generatedPrompt, imageUrlId: imageUrlRef.id });
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ 
            error: 'Failed to generate image', 
            details: error.message,
            stack: error.stack 
        });
    }
});

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const stripe = require('stripe')(stripeSecretKey);

app.post('/create-checkout-session', async (req, res) => {
    const { hdImageUrl, imageUrlId } = req.body;
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            metadata: {
                imageUrlId,
            },
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'HD Image',
                    },
                    unit_amount: 99, // Amount in cents
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `https://sound-d3d84.web.app/pages/success.html?session_id={CHECKOUT_SESSION_ID}&target=_blank`,
            cancel_url: `https://sound-d3d84.web.app/pages/cancel.html?target=_blank`,
            // success_url: `http://localhost:3000/pages/success.html?session_id={CHECKOUT_SESSION_ID}&target=_blank`,
            // cancel_url: `http://localhost:3000/pages/cancel.html?target=_blank`,
        });
        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

app.get('/verify-payment', async (req, res) => {
    const sessionId = req.query.session_id;
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === 'paid') {
            const imageUrlId = session.metadata.imageUrlId;
            const imageUrlRef = db.collection('imageUrls').doc(imageUrlId);
            const imageUrlDoc = await imageUrlRef.get();
            if (imageUrlDoc.exists) {
              res.json({ paymentStatus: 'paid', hdImageUrl: imageUrlDoc.data().hdImageUrl });
            } else {
              res.status(404).json({ error: 'Image URL not found' });
            }
          } else {
            res.json({ paymentStatus: 'unpaid' });
          }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
});


app.post('/api/logout', (req, res) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.clearCookie('connect.sid');
            res.sendStatus(200);
        });
    });
});

const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Middleware to ensure authentication
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// console.log(`Server is running on https://soundcanvas.firebaseapp.com/`);