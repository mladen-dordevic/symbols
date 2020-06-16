import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class IconService {

  public strikeDit(strike: number, dip: number, color = 'red'): string {
    const size = 30;
    const text = ''//this.createText(dip.toFixed() + '°', 'white', size);
    // const symbol = this.createSymbol(size, strike, color);
    const symbol = this.createSymbol2(size, strike, dip.toFixed() + '°', color);
    return this.getBase(symbol + text, size * Math.sqrt(2), size * Math.sqrt(2));
  }

  private getBase(content: string, width: number, height: number): string {
    const svg = `<?xml version="1.0"?>
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">
        ${content}
      </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }
  private createSymbol(s: number, strike: number = 0, color = 'red'): string {
    const t = s / 5;
    const o = (Math.sqrt(2) * s - s) / 2;
    return `<g fill="grey" transform="rotate(${strike} ${s / 2 + o} ${s / 2 + o})">
     <polygon points="${o},${o} ${s + o},${o} ${s + o},${t + o} ${(s + t) / 2 + o},${t + o} ${(s + t) / 2 + o},${s + o} ${(s - t) / 2 + o},${s + o} ${(s - t) / 2 + o},${t + o} ${o},${t + o} ${o},${o}" style="fill:${color}" stroke="black" />
    </g>`;
  }

  private createText(text: string, fill: string = 'white', size: number): string {
    return `<text x="0" y="${size}" fill="${fill}">${text}</text>`;
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
