const express = require('express');
const router = express.Router();
const fs = require('fs');
const Playlist = require('../models/playlist.model');
const routeController = require('../controllers/route.controller');
const validationController = require('../controllers/validation.controller');
const fileController = require('../controllers/file.controller');
const playlistController = require('../controllers/playlist.controller');

router.get('/', (req, res) => {
    Playlist.find()
    .populate('songs')
        .exec((err, playlists) => {
            if (err) {
                routeController.problem(res);
            } else if (playlists == false) {
                res.json({
                    response: false,
                    message: 'There are no playlists'
                });
            } else {
                res.json(playlists);
            }
        });
});

router.get('/favorite', (req, res) => {
    Playlist.find({
        isFavorite: true
    })
    .populate('songs')
        .exec((err, playlists) => {
            if (err) {
                routeController.problem(res);
            } else {
                res.json(playlists)
            }
        });
});

router.get('/:id', (req, res) => {
    Playlist.findOne({
        _id: req.params.id
    })
    .populate('songs')
        .exec((err, playlists) => {
            if (err) {
                res.json({
                    response: false,
                    message: 'There are no playlist with this id'
                });
            } else {
                res.json(playlists);
            }
        });
});

router.get('/name/:name', (req, res) => {
    Playlist.find({
        name: {
            $regex: '.*' + req.params.name + '.*',
            $options: 'i'
        } 
    })
    .populate('songs')
        .exec((err, playlists) => {
            if (err) {
                routeController.problem(res);
            } else {
                res.json(playlists);
            }
        });
});

router.get('/favorite/name/:name', (req, res) => {
    Playlist.find({
        name: {
            $regex: '.*' + req.params.name + '.*',
            $options: 'i'
        },
        isFavorite: true
    })
    .populate('songs')
        .exec((err, playlists) => {
            if (err) {
                routeController.problem(res);
            } else {
                res.json(playlists);
            }
        });
});

router.get('/genre/:genre', (req, res) => { 
    Playlist.find({
        genre: {
            $regex: '.*' + req.params.genre + '.*',
            $options: 'i'
        } 
    })
    .populate('songs')
        .exec((err, playlists) => {
            if (err) {
                routeController.problem(res);
            } else if (playlists == false) {
                res.json({
                    response: false,
                    message: 'No playlists found by this genre'
                });
            } else {
                res.json(playlists);
            }
        });
});

router.post('/', (req, res) => {
    let errors = [];

    let playlistName = '';
    let genre = '';
    let album = '';
    let existAlbum = '';
    let songNames = '';
    let songAudios = '';
    let existSongs = '';
    let playlistId = '';
    let isPlaylistNameDuplicate = false;
    
    if (req.body.existSongs) {
        existSongs = req.body.existSongs;
    }

    if (req.body.existAlbum) {
        existAlbum = req.body.existAlbum;
    }

    if (req.body.playlistId) {
        playlistId = req.body.playlistId;
    }

    if (req.files) {
        if ('album' in req.files) {
            album = req.files.album;

            if (!fileController.checkFileType(album, 'album')) {
                errors.push('Only images are accepeted');
            } else if (!fileController.checkFileSize(album, 1)) {
                errors.push('The size of this image is too large');
            }
        }

        if ('songs' in req.files) {
            if (req.files.songs.constructor === Array) {
                songAudios = req.files.songs;
            } else {
                songAudios = [req.files.songs];
            }
        }
    }

    if (!validationController(req.body.playlistName, /^[A-Za-z0-9!@#$%^&*()_., ]{3,255}$/)) {
        errors.push('Playlist name is invalid');
    } else {
        playlistName = req.body.playlistName;

        if (req.body.existPlaylistName) {
            if (playlistName === req.body.existPlaylistName) {
                isPlaylistNameDuplicate = true;
            }
        }
    }

    if (!validationController(req.body.genre, /^[A-Za-z0-9 &]{3,55}$/)) {
        errors.push('Genre name is invalid');
    } else {
        genre = req.body.genre;
    }

    if (album.constructor !== Object && existAlbum === '') {
        album = null;
    } else if (album.constructor !== Object && existAlbum !== '') {
        if (existAlbum === "null") {
            album = null;
        } else {
            album = existAlbum;
        }
    }

    if (req.body.songName) {
        if (req.body.songName.constructor === Array) {
            songNames = req.body.songName;
        } else {
            songNames = [req.body.songName];
        }

        for (let songName of songNames) {
            let l = 0;

            if (!validationController(songName, /^[A-Za-z0-9!@#$%^&*()_., -]{3,255}$/)) {
                errors.push('Song name is invalid');
                break;
            }

            for (let songNameSpec of songNames) {
                if (songName === songNameSpec) {
                    l++;
                }
            }

            if (l >= 2) {
                errors.push('You have two songs with the same name');
                break;
            }
        }
    }

    if (songAudios !== '') {
        for (let songAudio of songAudios) {
            if (!fileController.checkFileType(songAudio, 'song')) {
                errors.push('Song is invalid');
                break;
            } else if (!fileController.checkFileSize(songAudio, '20')) {
                errors.push('The size of the song is too large');
                break;
            }
        }
    }

    if (songNames.length !== songAudios.length) {
        errors.push('You have a missing arguments in your songs');
    }

    if (songNames === '' && existSongs === '' && songAudios === '') {
        errors.push('You need to choose at least one song to your playlist');
    }
    
    if (errors.length === 0) {
        playlistController.checkExistOverall(playlistName, isPlaylistNameDuplicate,  songNames, (isExist, errors) => {
            if (isExist) {
                res.json({
                    response: false,
                    errors: errors
                });
            } else {
                if (album !== null && album.constructor === Object) {
                    fileController.moveFile(album, 'album', false, (image) => {
                        album = image;
                        playlistController.setPlaylist(playlistName, album, genre, existSongs, songAudios, songNames, playlistId, res);
                    });
                } else {
                    playlistController.setPlaylist(playlistName, album, genre, existSongs, songAudios, songNames, playlistId, res);
                }
            }
        });
    } else {
        res.json({
            response: false,
            errors: errors
        });
    }
});

router.put('/favorite/:id', (req, res) => {
    let playlistId = req.params.id;

    playlistController.checkIfFavorite(playlistId, (bool) => {
        Playlist.findOneAndUpdate({
            _id: playlistId
        }, {
            $set: {
                isFavorite: bool
            }
        }, {
            upsert: true
        }, (err, newSong) => {
            if (err) {
                res.json({
                    response: false,
                    message: 'There was problem by update this playlist'
                });
            } else {
                res.json({
                    response: true,
                    message: 'This playlist updated successfully'
                });
            }
        });
    });
});

router.delete('/:id', (req, res) => {
    Playlist.findOneAndRemove({
        _id: req.params.id
    }, (err, playlist) => {
        if (err) {
            routeController.problem(res);
        } else {
            if (playlist.image !== null) {
                fs.unlinkSync('public/images/albums/' + playlist.image);
            }

            res.json({
                response: true,
                message: 'Playlist deleted successfully'
            });
        }
    });
});

module.exports = router;
