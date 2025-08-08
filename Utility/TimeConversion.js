class Numbers {
  addNotation(x) {
    if (x === undefined) {
      return "";
    }
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  timeSince(date) {
    let time = Date.now() - date;

    if (time > 30 * 60000) {
      return this.timeNumberHour(time);
    }
    return this.timeNumberMin(time);
  }

  timeNumberHour(time) {
    let hours = Math.floor(time / 1000 / 60 / 60);
    let mins = Math.floor(time / 1000 / 60) % 60;
    d;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  }

  timeNumberMin(time, secondDecimals = 0) {
    let mins = Math.floor(time / 1000 / 60);
    let secs = (time / 1000) % 60;

    if (mins === 0) return `${secs.toFixed(secondDecimals)}s`;
    return `${mins}m ${secs.toFixed(secondDecimals)}s`;
  }
}

export const Conversions = new Numbers();
