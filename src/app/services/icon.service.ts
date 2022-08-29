import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class IconService {

  public strikeDit(strike: number, dip: number, color = 'red'): string {
    const size = 30;
    const text = ''
    const symbol = this.createSymbol2(size, strike, dip.toFixed() + '°', color);
    return this.getBase(symbol + text, size * Math.sqrt(3), size * Math.sqrt(3));
  }

  public trendPlunge(strike: number, dip: number, color = 'red'): string {
    const size = 30;
    const text = '';
    const symbol = this.createSymbol(size, strike, dip.toFixed() + '°', color);
    return this.getBase(symbol + text, size * Math.sqrt(3), size * Math.sqrt(3));
  }

  public circleIcon(color = 'red'): string {
    const size = 15;
    const symbol = this.createCircle(size / 2, color);
    return this.getBase(symbol, size * Math.sqrt(2), size * Math.sqrt(2));
  }

  private getBase(content: string, width: number, height: number): string {
    const svg = `<?xml version="1.0"?>
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">
        ${content}
      </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }
  private createSymbol(s: number, strike: number = 0, dip: string = '0', color = 'orange'): string {
    const t = s / 5;
    const o = (Math.sqrt(2) * s - s) / 2;
    const arrowSize = 5;
    return `
      <defs>
        <marker id="arrow" viewBox="0 0 ${arrowSize} ${arrowSize}" refX="${arrowSize / 2}" refY="${arrowSize / 2}"
            markerWidth="${arrowSize}" markerHeight="${arrowSize}"
            orient="auto-start-reverse">
          <path d="M 0 ${0.3 * arrowSize} L ${arrowSize} ${arrowSize / 2} L 0 ${0.7 * arrowSize
      } z" fill="${color}" stroke="${color}"/>
    < /marker>
    < /defs>
    < g fill = "grey" transform = "rotate(${strike} ${s / 2 + o} ${s / 2 + o})" >
      <polyline points="${s / 2},${s * 0.2} ${s / 2},${s * 0.8}" fill = "none" stroke = "${color}" stroke - width="3" marker - end="url(#arrow)" />
        <text x="${0.85 * s}" y = "${0.55 * s}" font - size="12px" fill = "white" transform = "rotate(-${strike},22,22)" text - anchor="start" > ${dip} </text>
          < /g>`;
  }

  private createText(text: string, fill: string = 'white', size: number): string {
    return `<text x="0" y="${size}" fill="${fill}">${text}</text>`;
  }

  private createCircle(r: number, fill: string = 'white'): string {
    return `<circle cx="${r}" cy="${r}" r="${r}" fill="${fill}" stroke="black"/>`;
  }

  private createSymbol2(s: number, strike: number = 0, dip: string, color = 'red'): string {
    const t = s / 5;
    const o = (Math.sqrt(2) * s - s) / 2;
    const ord = [
      [(s - t) / 2, 0],
      [(s + t) / 2, 0],
      [(s + t) / 2, (s - t) / 2],
      [3.5 * s / 4, (s - t) / 2],
      [3.5 * s / 4, (s + t) / 2],
      [(s + t) / 2, (s + t) / 2],
      [(s + t) / 2, s],
      [(s - t) / 2, s]
    ];
    const string = ord.map(el => el.map(elIn => elIn + o).join(',')).join(' ');

    return `<g fill="grey" transform="rotate(${strike} ${s / 2 + o} ${s / 2 + o})">
     <polygon points="${string}" style="fill:${color}" stroke="black" />
     <text x="${0.85 * s}" y="${0.55 * s}" font-size="12px" fill="white">${dip}</text>
    </g>`;
  }

}
