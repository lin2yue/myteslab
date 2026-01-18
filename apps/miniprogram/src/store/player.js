import { defineStore } from 'pinia'
import { audioService } from '../services/audio'

export const usePlayerStore = defineStore('player', {
    state: () => ({
        currentAudio: null,
        isPlaying: false,
        duration: 0,
        currentTime: 0,
        innerAudioContext: null
    }),
    actions: {
        initContext() {
            if (!this.innerAudioContext) {
                this.innerAudioContext = uni.createInnerAudioContext();

                // FORCE SPEAKER OUTPUT & IGNORE MUTE SWITCH
                const isDevTools = (() => {
                    try {
                        const info = typeof uni.getSystemInfoSync === 'function' ? uni.getSystemInfoSync() : null;
                        return info && info.platform === 'devtools';
                    } catch (err) {
                        return false;
                    }
                })();

                if (!isDevTools && typeof uni.setInnerAudioOption === 'function') {
                    try {
                        const result = uni.setInnerAudioOption({
                            obeyMuteSwitch: false, // Play even if switch is on silent
                            speakerOn: true       // Force bottom speaker
                        });
                        if (result && typeof result.then === 'function') {
                            result.catch((err) => {
                                console.debug('setInnerAudioOption rejected:', err);
                            });
                        }
                    } catch (err) {
                        console.debug('setInnerAudioOption threw:', err);
                    }
                }

                this.innerAudioContext.onPlay(() => {
                    this.isPlaying = true;
                });
                this.innerAudioContext.onPause(() => {
                    this.isPlaying = false;
                });
                this.innerAudioContext.onEnded(() => {
                    this.isPlaying = false;
                    this.currentTime = 0;
                });
                this.innerAudioContext.onTimeUpdate(() => {
                    if (this.innerAudioContext) {
                        this.currentTime = this.innerAudioContext.currentTime;
                        this.duration = this.innerAudioContext.duration;
                    }
                });
                this.innerAudioContext.onError((res) => {
                    console.error('InnerAudioContext error:', res);
                    this.isPlaying = false;
                });
            }
        },
        play(audio) {
            if (!audio) return;
            this.initContext();
            if (!this.innerAudioContext) return;

            if (this.currentAudio?.id === audio.id) {
                this.toggle();
                return;
            }

            audioService.incrementStat(audio.id, 'play');

            const playableUrl = audioService.getPlayableUrl(audio.file_url);
            if (!playableUrl) return;

            try {
                this.innerAudioContext.stop();
            } catch (err) {
                console.warn('InnerAudioContext stop() failed:', err);
            }

            this.currentAudio = audio;
            this.currentTime = 0;
            this.duration = 0;

            this.innerAudioContext.src = playableUrl;

            try {
                this.innerAudioContext.title = audio.title || 'Audio';
            } catch (err) {
                console.warn('InnerAudioContext title set failed:', err);
            }

            try {
                const result = this.innerAudioContext.play();
                if (result && typeof result.then === 'function') {
                    result.catch((err) => {
                        console.error('InnerAudioContext play() rejected:', err);
                        this.isPlaying = false;
                    });
                }
            } catch (err) {
                console.error('InnerAudioContext play() threw:', err);
                this.isPlaying = false;
            }
        },
        toggle() {
            if (!this.innerAudioContext) return;
            if (this.innerAudioContext.paused) {
                this.innerAudioContext.play();
            } else {
                this.innerAudioContext.pause();
            }
        },
        close() {
            if (!this.innerAudioContext) return;
            this.innerAudioContext.stop();
            this.isPlaying = false;
            this.currentAudio = null;
        }
    }
})
