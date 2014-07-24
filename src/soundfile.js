define(function (require) {

  'use strict';

  require('sndcore');
  var p5sound = require('master');

  /**
   * <p>Create a SoundFile object with a path to a file.</p>
   * 
   * <p>The SoundFile may not be available immediately because
   * it loads the file information asynchronously.</p>
   *
   * <p>To do something with the sound as soon as it loads
   * pass the name of a function as the second parameter.</p>
   * 
   * <p>Only one file path is required. However, audio file formats 
   * (i.e. mp3, ogg, wav and m4a/aac) are not supported by all
   * web browsers. If you want to ensure compatability, instead of a single
   * file path, you may include an Array of filepaths, and the browser will
   * choose a format that works.</p>
   *
   * @class SoundFile
   * @constructor
   * @param {String/Array} path   path to a sound file (String). Optionally,
   *                              you may include multiple file formats in
   *                              an array.
   * @param {Function} [callback]   Name of a function to call once file loads
   * @return {Object}    SoundFile Object
   * @example 
   * <div><code>
   * function setup() {
   *   mySound = new SoundFile(['mySound.mp3', 'mySound.ogg'], onload);
   * }
   *
   * function onload() {
   *   mySound.play();
   * }
   * </code></div>
   */
  p5.prototype.SoundFile = function(paths, onload) {
    var path;

    // if path is a single string, check to see if extension is provided
    if (typeof(paths) === 'string') {
      path = paths;
      // see if extension is provided
      var extTest = path.split('.').pop();
      // if an extension is provided...
      if (['mp3','wav','ogg', 'm4a', 'aac'].indexOf(extTest) > -1) {
        var supported = p5.prototype.isFileSupported(extTest);
        if (supported){
          path = path;
        }
        else {
          var pathSplit = path.split('.');
          var pathCore = pathSplit[pathSplit.length - 2];
          for (var i = 0; i<p5sound.extensions.length; i++){
            var extension = p5sound.extensions[i];
            var supported = p5.prototype.isFileSupported(extension);
            if (supported) {
              pathCore = '';
              for (var i = 0; i <= pathSplit.length - 2; i++){
                pathCore.push(pathSplit[i]);
              }
              path = pathCore + '.' + extension;
              console.log(path);
              break;
            }
          }
        }
      }
      // if no extension is provided...
      else {
        for (var i = 0; i<p5sound.extensions.length; i++){
          var extension = p5sound.extensions[i];
          var supported = p5.prototype.isFileSupported(extension);
          if (supported) {
            path = path + '.' + extension;
            break;
          }
        }
      }
    } // end 'if string'

    // path can either be a single string, or an array
    else if (typeof(paths) === 'object') {
      for (var i = 0; i<paths.length; i++) {
        var extension = paths[i].split('.').pop();
        var supported = p5.prototype.isFileSupported(extension);
        if (supported) {
          console.log('.'+extension + ' is ' + supported +
           ' supported by your browser.');
          path = paths[i];
          break;
        }
      }
    }

    // player variables
    this.url = path;

    // array of sources so that they can all be stopped!
    this.sources = [];

    // current source
    this.source = null;

    this.buffer = null;
    this.playbackRate = 1;
    this.gain = 1;

    this.input = p5sound.audiocontext.createGain();
    this.output = p5sound.audiocontext.createGain();

    this.reversed = false;

    // start and end of playback / loop
    this.startTime = 0;
    this.endTime = null;

    // playing - defaults to false
    this.playing = false;

    // paused - defaults to true
    this.paused = null;

    // "restart" would stop playback before retriggering
    this.mode = 'sustain';

    // time that playback was started, in millis
    this.startMillis = null;

    // stereo panning
    this.panPosition = 0.0;
    this.panner = p5sound.audiocontext.createPanner();
    this.panner.panningModel = 'equalpower';
    this.panner.distanceModel = 'linear';
    this.panner.setPosition(0,0,0);

    this.output.connect(this.panner);

    // by default, the panner is connected to the p5s destination
    this.panner.connect(p5sound.input);

    this.load(onload);

    // add this SoundFile to the soundArray
    p5sound.soundArray.push(this);
  };

  /**
   * <p>This is a helper function that the SoundFile calls to load
   * itself. Accepts a callback (the name of another function)
   * as an optional parameter.</p> 
   *
   * @method  load
   * @private
   * @param {Function} [callback]   Name of a function to call once file loads
   */
  p5.prototype.SoundFile.prototype.load = function(callback){
    if (!this.buffer) {
      var request = new XMLHttpRequest();
      request.open('GET', this.url, true);
      request.responseType = 'arraybuffer';
      // decode asyncrohonously
      var self = this;
      request.onload = function() {
        var ac = p5.prototype.getAudioContext();
        ac.decodeAudioData(request.response, function(buff) {
          self.buffer = buff;
          if (callback) {
            callback(self);
          }
        });
      };
      request.send();
    }
    else {
      if (callback){
        callback(this);
      }
    }
  };

  /**
   *  Returns true if the sound file has finished loading.
   *  
   *  @method  isLoaded
   *  @return {Boolean} 
   */
  p5.prototype.SoundFile.prototype.isLoaded = function() {
    if (this.buffer) {
      return true;
    } else {
      return false;
    }
  };

  /**
   * Play the SoundFile
   *
   * @method play
   * @param {Number} [rate]             (optional) playback rate
   * @param {Number} [amp]              (optional) amplitude (volume)
   *                                     of playback
   * @param {Number} [startTime]        (optional) startTime in seconds
   * @param {Number} [endTime]          (optional) endTime in seconds
   */
  p5.prototype.SoundFile.prototype.play = function(rate, amp, startTime, endTime) {
    // TO DO: if already playing, create array of buffers for easy stop()
    if (this.buffer) {

      // handle restart playmode
      if (this.mode === 'restart' && this.buffer && this.source) {
        this.source.stop();
      }

      if (startTime) {
        if (startTime >=0 && startTime < this.buffer.duration){
          this.startTime = startTime;
        } else {
          throw 'start time out of range';
        }
      }

      if (endTime) {
        if (endTime >=0 && endTime <= this.buffer.duration){
          this.endTime = endTime;
        } else {
          throw 'end time out of range';
        }
      }
      else {
          this.endTime = this.buffer.duration;
        }

      // make a new source
      this.source = p5sound.audiocontext.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.loop = this.looping;
      if (this.source.loop === true){
        this.source.loopStart = this.startTime;
        this.source.loopEnd = this.endTime;
      }
      this.source.onended = function() {
        if (this.playing) {
          this.playing = !this.playing;
          this.stop();
         }
       };

      // firefox method of controlling gain without resetting volume
      if (!this.source.gain) {
        this.source.gain = p5sound.audiocontext.createGain();
        this.source.connect(this.source.gain);
        // set local amp if provided, otherwise 1
        this.source.gain.gain.value = amp || 1;
        this.source.gain.connect(this.output); 
      }
      // chrome method of controlling gain without resetting volume
      else {
        this.source.gain.value = amp || 1;
        this.source.connect(this.output); 
      }
      this.source.playbackRate.value = rate || Math.abs(this.playbackRate);


      // play the sound
      if (this.paused){
        this.source.start(0, this.pauseTime, this.endTime);

        // flag for whether to use pauseTime or startTime to get currentTime()
        this.unpaused = true;
      }
      else {
        this.unpaused = false;
        this.source.start(0, this.startTime, this.endTime);
      }
      this.startSeconds = p5sound.audiocontext.currentTime;
      this.playing = true;
      this.paused = false;

      // add the source to sources array
      this.sources.push(this.source);
    }
    // If soundFile hasn't loaded the buffer yet, throw an error
    else {
      throw 'not ready to play file, buffer has yet to load. Try preload()';
    }
  };


  /**
   *  SoundFile has two play modes: <code>restart</code> and
   *  <code>sustain</code>. Play Mode determines what happens to a
   *  SoundFile if it is triggered while in the middle of playback.
   *  In sustain, the existing playback will continue. In restart
   *  .play() will stop playback and start over. Sustain is the
   *  default mode. 
   *  
   *  @method  playMode
   *  @param  {String} str 'restart' or 'sustain'
   */
  p5.prototype.SoundFile.prototype.playMode = function(str) {
    var s = str.toLowerCase();

    // if restart, stop all other sounds from playing
    if (s === 'restart' && this.buffer && this.source) {
      for (var i = 0; i < this.sources.length - 1; i++){
        this.sources[i].stop();
      }
    }

    // set play mode to effect future playback
    if (s === 'restart' || s === 'sustain') {
      this.mode = s;
    } else {
      throw 'Invalid play mode. Must be either "restart" or "sustain"';
    }
  };

  /**
   * Toggle whether a sound file is playing or paused.
   * 
   * Pauses a file that is currently playing,
   * and unpauses (plays) a file that is currently paused.
   *
   * The pauseTime and loop state are preserved
   * so playback can resume from the same spot in the sound file.
   *
   * @method pause
   */
  p5.prototype.SoundFile.prototype.pause = function() {
    var keepLoop = this.looping;
    if (this.isPlaying() && this.buffer && this.source) {
      this.pauseTime = this.currentTime();
      // this.startTime = this.currentTime();
      this.source.stop();
      this.paused = true;
      // TO DO: make sure play() still starts from orig start position
    }
    else {
        // preserve original start time
        var origStart = this.startTime;
        this.startTime = this.pauseTime;
        this.play();
        this.looping = keepLoop;
        this.startTime = origStart;
    }
  };


  /**
   * Loop the SoundFile. Accepts optional parameters to set the
   * playback rate, playback volume, loopStart, loopEnd.
   *
   * @method loop
   * @param {Number} [rate]             (optional) playback rate
   * @param {Number} [amp]              (optional) playback volume
   * @param {Number} [loopStart]        (optional) startTime in seconds
   * @param {Number} [loopEnd]          (optional) endTime in seconds
   */
  p5.prototype.SoundFile.prototype.loop = function(rate, amp, loopStart, loopEnd) {
    this.looping = true;
    this.play(rate, amp, loopStart, loopEnd);
  };

  /**
   * Set a SoundFile's looping flag to true or false. If the sound
   * is currently playing, this change will take effect when it
   * reaches the end of the current playback. 
   * 
   * @method setLoop
   * @param {Boolean} Boolean   set looping to true or false
   */
  p5.prototype.SoundFile.prototype.setLoop = function(bool) {
    if (bool === true) {
      this.looping = true;
    }
    else if (bool === false) {
      this.looping = false;
    }
    else {
      throw 'Error: setLoop accepts either true or false';
    }
    if (this.source) {
      this.source.loop = this.looping;
    }
  };

 /**
   * Returns 'true' if a SoundFile is looping, 'false' if not.
   *
   * @method isLooping
   * @return {Boolean}
   */
  p5.prototype.SoundFile.prototype.isLooping = function() {
    if (!this.source) {
      return false;
    }
    if (this.looping === true && this.isPlaying() === true) {
      return true;
    }
    return false;
  };

  /**
   * Returns 'true' if a SoundFile is playing, 'false' if not.
   *
   * @method isPlaying
   * @return {Boolean}
   */
  p5.prototype.SoundFile.prototype.isPlaying = function() {
    // Double check playback state
    if (this.source) {
      if (this.source.playbackState === 2) {
        this.playing = true;
      }
      if (this.source.playbackState === 3) {
        this.playing = false;
      }
    }
    return this.playing;
  };

  /**
   * Returns true if a SoundFile is paused, 'false' if not.
   *
   * @method isPaused
   * @return {Boolean}
   */
  p5.prototype.SoundFile.prototype.isPaused = function() {
    if (!this.paused) {
      return false;
    }
    return this.paused;
  };

  /**
   * Stop soundfile playback.
   *
   * @method stop
   */
  p5.prototype.SoundFile.prototype.stop = function() {
    if (this.buffer && this.source) {
      this.source.stop();
      this.pauseTime = 0;
      this.playing = false;
    }
  };

  /**
   * Stop playback on all of this soundfile's sources.
   * This may soon be replaced by different playModes for the player.
   *
   * @method stopAll
   */
  p5.prototype.SoundFile.prototype.stopAll = function() {
    if (this.buffer && this.source) {
      for (var i = 0; i < this.sources.length - 1; i++){
        if (this.sources[i] !== null){
          this.sources[i].stop();
        }
      }
    this.playing = false;
    }
  };

  /**
   * Set the playback rate of a sound file. Will change the speed and the pitch.
   * Values less than zero will reverse the audio buffer before playback.
   *
   * @method rate
   * @param {Number} [playbackRate]     Set the playback rate. 1.0 is normal,
   *                                    .5 is half-speed, 2.0 is twice as fast.
   *                                    Must be greater than zero.
   */
  p5.prototype.SoundFile.prototype.rate = function(playbackRate) {
    if (this.playbackRate === playbackRate) {
      return;
    }
    this.playbackRate = playbackRate;
    if (playbackRate === 0 && this.playing) {
      this.pause();
    }
    if (playbackRate < 0 && !this.reversed) {
      this.reverseBuffer();
    }
    else if (playbackRate > 0 && this.reversed) {
      this.reverseBuffer();
    }
    if (this.isPlaying() === true) {
      this.pause();
      this.play();
    }
  };

  p5.prototype.SoundFile.prototype.getPlaybackRate = function() {
    return this.playbackRate;
  };

  /**
    * Return the number of channels in a sound file.
    * For example, Mono = 1, Stereo = 2.
    *
    * @method channels
    * @return {Number} [channels]
    */
  p5.prototype.SoundFile.prototype.channels = function() {
    return this.buffer.numberOfChannels;
  };

  /**
    * Return the sample rate of the sound file.
    *
    * @method sampleRate
    * @return {Number} [sampleRate]
    */
  p5.prototype.SoundFile.prototype.sampleRate = function() {
    return this.buffer.sampleRate;
  };

  /**
    * Return the number of samples in a sound file.
    * Equal to sampleRate * duration.
    *
    * @method frames
    * @return {Number} [sampleCount]
    */
  p5.prototype.SoundFile.prototype.frames = function() {
    return this.buffer.length;
  };

  /**
   * Returns the duration of a sound file.
   *
   * @method duration
   * @return {Number}     The duration of the soundFile in seconds.
   */
  p5.prototype.SoundFile.prototype.duration = function() {
    // Return Duration
    if (this.buffer) {
      return this.buffer.duration;
    } else {
      return 0;
    }
  };

  /**
   * Return the current position of the playhead in the song, in seconds
   *
   * @method currentTime
   * @return {Number}   currentTime of the soundFile in seconds.
   */
  p5.prototype.SoundFile.prototype.currentTime = function() {
    // TO DO --> make reverse() flip these values appropriately ?
    var howLong;
    if (this.isPlaying() && !this.unpaused) {
        howLong = ( (p5sound.audiocontext.currentTime - this.startSeconds + this.startTime) * this.source.playbackRate.value ) % this.duration();
        return howLong;
    }
    else if (this.isPlaying() && this.unpaused) {
        howLong = ( this.pauseTime + (p5sound.audiocontext.currentTime - this.startSeconds) * this.source.playbackRate.value ) % this.duration();
        return howLong;
    }
    else if (this.paused) {
      return this.pauseTime;
    }
    else {
      return this.startTime;
    }
  };

  /**
   * Move the playhead of the song to a position, in seconds. Start
   * and Stop time. If none are given, will reset the file to play
   * entire duration from start to finish.
   *
   * @method jump
   * @param {Number} cueTime    cueTime of the soundFile in seconds.
   * @param {Number} endTime    endTime of the soundFile in seconds.
   */
  p5.prototype.SoundFile.prototype.jump = function(cueTime, endTime) {
    if (cueTime<0 || cueTime > this.buffer.duration) {
      throw 'jump time out of range';
    }
    if (endTime<cueTime || endTime > this.buffer.duration) {
      throw 'end time out of range';
    }
    this.startTime = cueTime || 0;
    if (endTime) {
      this.endTime = endTime;
    } else {
      this.endTime = this.buffer.duration;
    }

    // this.endTime = endTime || this.buffer.duration;
    if (this.isPlaying()){
      this.stop();
      this.play(cueTime, this.endTime);
    }
  };


  /**
   * Returns an array of amplitude peaks in a SoundFile that can be
   * used to draw a static waveform. Scans through the SoundFile's
   * audio buffer to find the greatest amplitudes. Accepts one
   * parameter, 'length', which determines size of the array.
   * Larger arrays result in more precise waveform visualizations.
   * 
   * Inspired by Wavesurfer.js.
   * 
   * @method  getPeaks
   * @params {[Number]} length length is the size of the returned array.
   *                          Larger length results in more precision.
   *                          Defaults to 5*width of the browser window.
   * @returns {Float32Array} Array of peaks.
   */
  p5.prototype.SoundFile.prototype.getPeaks = function(length) {
    if (this.buffer) {
      // set length to window's width if no length is provided
      if (!length) {
        length = window.width*5;
      }
      if (this.buffer) {
        var buffer = this.buffer;
        var sampleSize = buffer.length / length;
        var sampleStep = ~~(sampleSize / 10) || 1;
        var channels = buffer.numberOfChannels;
        var peaks = new Float32Array(length);

        for (var c = 0; c < channels; c++) {
          var chan = buffer.getChannelData(c);
          for (var i = 0; i < length; i++) {
            var start = ~~(i*sampleSize);
            var end = ~~(start + sampleSize);
            var max = 0;
            for (var j = start; j < end; j+= sampleStep) {
              var value = chan[j];
              if (value > max) {
                max = value;
              // faster than Math.abs
              } else if (-value > max) {
                max = value;
              }
            }
            if (c === 0 || max > peaks[i]) {
              peaks[i] = max;
            }
          }
        }

        return peaks;
      }
    }
    else {
      throw 'Cannot load peaks yet, buffer is not loaded';
    }
  };

  /**
   * Reverses the SoundFile's buffer source.
   * Playback must be handled separately (see example).
   *
   * @method  reverseBuffer
   * @example
   * <div><code>
   * s = new SoundFile('beat.mp3');
   * s.reverseBuffer();
   * s.play();
   * </code>
   * </div>
   */
  p5.prototype.SoundFile.prototype.reverseBuffer = function() {
    if (this.buffer) {
      Array.prototype.reverse.call( this.buffer.getChannelData(0) );
      Array.prototype.reverse.call( this.buffer.getChannelData(1) );
    // set reversed flag
    this.reversed = !this.reversed;
    // this.playbackRate = -this.playbackRate;
    } else {
      throw 'SoundFile is not done loading';
    }
  };

  // private function for onended behavior
  p5.prototype.SoundFile.prototype._onEnded = function(s) {
    s.onended = function(s){
      console.log(s);
      s.stop();
    };
  };

  /**
   *  Multiply the output volume (amplitude) of a sound file
   *  between 0.0 (silence) and 1.0 (full volume).
   *  1.0 is the maximum amplitude of a digital sound, so multiplying
   *  by greater than 1.0 may cause digital distortion.</p> <p>To
   *  fade, provide a <code>rampTime</code> parameter. For more
   *  complex fades, see the Env class.</p>
   *
   *  @method  setVolume
   *  @param {Number} volume  Volume (amplitude) between 0.0 and 1.0
   *  @param {[Number]} rampTime  Fade for t seconds
   *  @param {[Number]} timeFromNow  Schedule this event to happen at
   *                                 t seconds in the future
   */
  p5.prototype.SoundFile.prototype.setVolume = function(vol, rampTime, tFromNow) {
    console.log('yo');
      var rampTime = rampTime || 0;
      var tFromNow = tFromNow || 0;
      var now = p5sound.audiocontext.currentTime;
      var currentVol = this.output.gain.value;
      this.output.gain.cancelScheduledValues(now);
      this.output.gain.setValueAtTime(currentVol, now + tFromNow);
      this.output.gain.linearRampToValueAtTime(vol, now + tFromNow + rampTime);
  };


  p5.prototype.SoundFile.prototype.add = function() {
    // TO DO
  };

  p5.prototype.SoundFile.prototype.dispose = function() {
    if (this.buffer && this.source) {
      for (var i = 0; i < this.sources.length - 1; i++){
        if (this.sources[i] !== null){
          // this.sources[i].disconnect();
          this.sources[i].stop();
          this.sources[i] = null;
        }
      }
    }
    if (this.output !== null){
      this.output.disconnect();
      this.output = null;
    }
    if (this.panner !== null){
      this.panner.disconnect();
      this.panner = null;
    }
  };

// =============================================================================
//                 SoundFile Methods Shared With Other Classes
// =============================================================================

  /**
   * Set the stereo panning of a p5Sound object to
   * a floating point number between -1.0 (left) and 1.0 (right).
   * Default is 0.0 (center).
   *
   * @method pan
   * @param {Number} [panValue]     Set the stereo panner
   */
  p5.prototype.SoundFile.prototype.pan = function(pval) {
    this.panPosition = pval;
    pval = pval * 90.0;
    var xDeg = parseInt(pval);
    var zDeg = xDeg + 90;
    if (zDeg > 90) {
      zDeg = 180 - zDeg;
    }
    var x = Math.sin(xDeg * (Math.PI / 180));
    var z = Math.sin(zDeg * (Math.PI / 180));
    this.panner.setPosition(x, 0, z);
  };

  /**
   * Returns the current stereo pan position (-1.0 to 1.0)
   *
   * @method getPan
   * @return {Number} Returns the stereo pan setting of the Oscillator
   *                          as a number between -1.0 (left) and 1.0 (right).
   *                          0.0 is center and default.
   */
  p5.prototype.SoundFile.prototype.getPan = function() {
    return this.panPosition;
  };

  /**
   * <p>Connects the output of a p5sound object to input of another
   * p5Sound object. For example, you may connect a SoundFile to an
   * Effect.</p>
   * 
   * <p>If no parameter is given, this object will connect
   * to the master output.</p>
   * 
   * <p>Most p5sound objects connect to the master output when they
   * are created, so you can hear them without ever using this
   * function. AudioIn is the only exception: you will not hear 
   * the AudioIn unless you explicitly tell it to connect.
   * This is because connecting a microphone input through your
   * speakers can cause feedback</p>
   *
   * @method connect
   * @param {[object]} p5Sound_Object p5Sound objects can connect (send their
   *                                  output) to other p5Sound objects
   */
  p5.prototype.SoundFile.prototype.connect = function(unit) {
    if (!unit) {
       this.panner.connect(p5sound.input);
    }
    else if (this.buffer && this.source) {
      if (unit.hasOwnProperty('input')){
        this.panner.connect(unit.input);
      } else {
      this.panner.connect(unit);
      }
    }
  };

  /**
   * Disconnects the output of this p5sound object.
   *
   * @method disconnect
   */
  p5.prototype.SoundFile.prototype.disconnect = function(unit){
    this.panner.disconnect(unit);
  };


  // register preload handling of loadSound
  p5.prototype._registerPreloadFunc('loadSound');

  /**
   * <p>loadSound() should be used if you want to create a SoundFile 
   * during preload. It returns a new SoundFile from a specified
   * path, or an array of paths. If used outside of preload, it 
   * accepts a callback as the second parameter.</p>
   * <p>Using a <a href=
   * "https://github.com/lmccart/p5.js/wiki/Local-server">
   * local server</a> is recommended when loading external files.</p>
   *  
   * @method loadSound
   * @param  {String/Array}   path     Path to the sound file, or an array with
   *                                   paths to soundfiles in multiple formats
   *                                   i.e. ['sound.ogg', 'sound.mp3']
   * @param {Function} [callback]   Name of a function to call once file loads
   * @return {SoundFile}            Returns a SoundFile
   * @example 
   * <div><code>
   * function preload() {
   *   mySound = loadSound(['mySound.mp3', 'mySound.ogg']);
   * }
   *
   * function setup() {
   *   mySound.loop();
   * }
   * </code></div>
   */
  p5.prototype.loadSound = function(path, callback){
    // if loading locally without a server
    if (window.location.origin.indexOf('file://') > -1) {
      alert('This sketch may require a server to load external files. Please see http://bit.ly/1qcInwS');
    }

    var s = new p5.prototype.SoundFile(path, callback);
    return s;
  };

  /**
   *  List the SoundFile formats that you will include. LoadSound 
   *  will search your directory for these extensions, and will pick
   *  a format that is compatable with the user's web browser.
   *  
   *  @param {String} format(s) i.e. 'mp3', 'wav', 'ogg'
   *  @example
   *  <div><code>
   *  function preload() {
   *    // set the global sound formats
   *    soundFormats('mp3, 'ogg');
   *    
   *    // load either beatbox.mp3, or .ogg, depending on browser
   *    mySound = new SoundFile('beatbox');
   *  }
   *
   *  function onload() {
   *    mySound.play();
   *  }
   *  </code></div>
   */
  p5.prototype.soundFormats = function(){
    // reset extensions array
    p5sound.extensions = [];
    // add extensions
    for (var i = 0; i < arguments.length; i++){
      arguments[i] = arguments[i].toLowerCase();
      if (['mp3','wav','ogg', 'm4a', 'aac'].indexOf(arguments[i]) > -1){
        p5sound.extensions.push(arguments[i]);
      } else {
        throw arguments[i] + ' is not a valid sound format!';
      }
    }
  };

});
