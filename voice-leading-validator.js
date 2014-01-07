function validate(xml) {
  var measures = parseMeasures(xml);

  var violations = [];

  var consolidatedChords = [];
  $.each(measures, function(i, m) { 
    $.each(m.chords, function(j, chord) { 
      chord.measure = m.number;
      consolidatedChords.push(chord);
    });
  });
  
  var prevChord;
  var prevChordIntervals;
  $.each(consolidatedChords, function(p, chord) {
    $.each(chord.notes, function(i, note) {
      var range = VOCAL_RANGE[i];
      if (range.low > note.magnitude()) {
        violations.push({ error: note + " too low for voice in measure " + chord.measure});
      }
      else if (range.high < note.magnitude()) {
        violations.push({ error: note + " too high for voice in measure " + chord.measure});
      }
    });
    var chordIntervals = chord.getIntervals();
    if (prevChordIntervals) {
      // Compare current chord with prev to find parallel 5ths, 8ves
      $.each(chordIntervals, function(i, interval) {
        $.each(prevChordIntervals, function(j, prevInterval) {
          if (prevInterval.movesParallelTo(interval)) {
            if (interval.delta == 7) {
              violations.push({ error: "Parallel 5th: measure " + prevChord.measure + ' ' + prevInterval + ' to measure ' + chord.measure + ' ' + interval});
            }
            else if (interval.delta == 12) {
              violations.push({ error: "Parallel Octave: measure " + prevChord.measure + ' ' + prevInterval + ' to measure ' + chord.measure + ' ' + interval});
            }
          }
        });
      });
    }
    prevChord = chord;
    prevChordIntervals = chordIntervals;
  });

  return violations;
}

function parseMeasures(xml) {
  var measures = [];
  $(xml).find('part').each(function() {
    $(this).find('measure').each(function() {
      var i = $(this).attr('number') - 1;
      var measure = measures[i] || { number: i + 1, chords: {} };
      measures[i] = measure;
      parseMeasure($(this), measure);
    });
  });
  
  $(measures).each(function(i, m) { 
    $.each(m.chords, function(p, chord) {
      chord.notes.sort(function(a, b) { return a.magnitude() - b.magnitude(); });
    });
  });
  return measures;
}

var NOTE_OFFSETS = { 'A' : 9, 'B' : 11, 'C' : 0, 'D' : 2, 'E' : 4, 'F' : 5, 'G' : 7 };
var VOCAL_RANGE = {
  0 : { low: newNote('E', 2, 0, 0).magnitude(), high: newNote('C', 4, 0, 0).magnitude() },
  1 : { low: newNote('C', 2, 0, 0).magnitude(), high: newNote('F', 4, 0, 0).magnitude() },
  2 : { low: newNote('G', 3, 0, 0).magnitude(), high: newNote('D', 5, 0, 0).magnitude() },
  3 : { low: newNote('C', 4, 0, 0).magnitude(), high: newNote('A', 7, 0, 0).magnitude() }
}

function newInterval(lowNote, highNote, lowVoice, highVoice) {
  return {
    low: lowNote,
    high: highNote,
    lowVoice: lowVoice,
    highVoice: highVoice,
    delta: highNote.magnitude() - lowNote.magnitude(),
    toString: function() { return this.low + ' -> ' + this.high; },
    movesParallelTo: function(other) {
      return this.delta == other.delta && this.low.magnitude() != other.low.magnitude() && this.lowVoice == other.lowVoice && this.highVoice == other.highVoice;
    }
  }
}

function newChord(pos) {
  return { 
    index: pos, 
    notes: [], 
    toString: function() { return this.notes.toString(); },
    getIntervals: function(chord) {
      var intervals = [];
      for (var i = 0; i < this.notes.length; i++) {
        for (var j = i; j < this.notes.length; j++) {
          intervals.push(newInterval(this.notes[i], this.notes[j], i, j));
        }
      }
      return intervals;
    }
  };
}

function newNoteFromXml(node) {
  return newNote(
    node.find('pitch').find('step').text(),
    node.find('pitch').find('octave').text(),
    +node.find('pitch').find('alter').text(),
    +node.find('duration').text());
}

function newNote(step, octave, alter, duration) {
  return {
    step: step,
    octave: octave,
    alter: alter,
    duration: duration,
    getSymbol: function() { 
      return this.step + ({ '-1': '-', '-2': '--', '1': '+', '2': '++' }[this.alter] || '') + this.octave;
    },
    toString: function() { return this.getSymbol() },
    magnitude: function() { return (this.octave * 12) + NOTE_OFFSETS[this.step] + this.alter; }
  };
}

function parseMeasure(xml, measure) {
  var pos = 0;
  var prevNote;
  $(xml).find('note, backup').each(function() {
    var node = $(this);
    var type = node.prop('tagName');
    if (type == 'backup') {
      pos -= node.find('duration').text();
    }
    else { // note
      if (node.find('chord').size() == 1) {
        pos -= prevNote.duration;
      }
      
      var duration = +node.find('duration').text();
      if (node.find('rest').size() == 1) {
        // For purposes of voice leading, treat rests as if they are extensions of the previous note
        if (prevNote) prevNote.duration += duration;
      }
      else {
        var chord = measure.chords[pos] || newChord(pos);
        measure.chords[pos] = chord;

        var note = newNoteFromXml(node);
        
        chord.notes.push(note);
        
        prevNote = note;
      }
      pos += duration;
    }
  });
}