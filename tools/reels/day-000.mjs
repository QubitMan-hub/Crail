// Shot list for the Day 0 Reel. Times are in seconds.
export default {
  seconds: 29,
  // Keys held between two times. D = down-right, W = up-right, A = up-left, S = down-left.
  keys: [
    [3.3, 3.75, 'D'], [4.2, 4.65, 'W'], [5.1, 5.4, 'A'], [5.9, 6.4, 'S'],
    [7.0, 10.6, 'D'],
    [11.4, 14.2, 'A'],
    [17.2, 17.45, 'W'],
    [24.0, 24.1, 'D'],
  ],
  // Camera zoom keyframes [time, zoom], eased between.
  zoom: [[0, 1.12], [3, 1.0], [17, 1.0], [23, 1.7], [24.2, 1.7], [25.2, 1.0], [29, 1.0]],
  // Big titles, upper part of the frame.
  titles: [
    [0.15, 2.9, 'DAY 0'],
    [8.2, 10.8, 'still nothing'],
    [12.6, 16.8, 'TOP COMMENT\n= NEXT FEATURE'],
    [17.6, 22.8, '24 HOURS'],
    [25.0, 29, 'CRAIL\nlink in bio'],
  ],
  // Captions: the voice-over, line by line. Retimed once the real voice is recorded.
  captions: [
    [0.1, 3.0, 'Day zero of letting Instagram comments build my game.'],
    [3.2, 6.8, 'This is the game. One cube. It rolls. That’s everything.'],
    [7.0, 10.8, 'No enemies. No levels. No goal. Just… floor.'],
    [11.2, 13.4, 'So here’s the deal.'],
    [13.4, 16.9, 'Whatever the top comment on this video says, I add it to the game.'],
    [17.2, 19.2, 'You’ve got 24 hours.'],
    [19.2, 22.9, 'In two days I’m back, with your idea in the game and your name on it.'],
    [23.2, 25.6, 'It’s called CRAIL.'],
    [25.6, 28.6, 'Play it right now, link’s in my bio. Don’t waste the first one.'],
  ],
};
