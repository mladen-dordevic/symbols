import { HeaderNames } from 'src/app/enum/header-names.enum';
export interface LatLngAlt {
  lat: number;
  lng: number;
  alt: number;
}

export interface Orientation {
  strike: number;
  dip: number;
}

// Default tag for untagged entries
export const TAG_ALL = "Tag:Undesignated spots";
const STORAGE_COLOR_KEY = 'color-storage';
export interface TagColor {
  tag: string;
  color: string;
}

export class TableCSV {
  // headerNames = Object.keys(HeaderNames).filter((v) => isNaN(Number(v)));
  headerNames = [];
  headerOrder = [];
  tagColors: TagColor[] = [];
  private storedColors: TagColor[] = [];
  rawData: string;
  data: [][] = [];

  isNumeric(val: any): boolean {
    const test = parseFloat(val);
    return !isNaN(test) && isFinite(test);
  }

  private initHeaderOrder(length: number = +Infinity) {
    this.headerOrder = this.headerNames.map((e, i) => i).filter((e, i) => i < length);
  }

  setHeader(data: string[]): void {
    this.headerNames = data;
    this.initTagColors();
  }

  setData(data: any) {
    this.data = data;
    this.headerNames = [...data[0]];
    this.initHeaderOrder(this.data[0].length);
  }

  getCol(row: any[], headerName: HeaderNames): string {
    const index = this.headerNames.indexOf(headerName);
    return row[this.headerOrder.indexOf(index)];
  }

  validateCellType(value: any, colIndex: number): boolean | null {
    const type = this.headerNames[this.headerOrder[colIndex]];
    switch (type) {
      case HeaderNames.Longitude:
        return this.isNumeric(value) && +value >= -180 && +value <= 180;
      case HeaderNames.Latitude:
        return this.isNumeric(value) && +value >= -90 && +value <= 90;
      case HeaderNames['Planar Orientation Strike']:
        return this.isNumeric(value) && +value >= 0 && +value < 360;
      case HeaderNames['Planar Orientation Dip']:
        return this.isNumeric(value) && +value >= 0 && +value <= 90;
      case HeaderNames['Linear Orientation Trend']:
        return this.isNumeric(value) && +value >= 0 && +value < 360;
      case HeaderNames['Linear Orientation Plunge']:
        return this.isNumeric(value) && +value >= 0 && +value <= 90;
      default:
        return null;
    }
  }

  getUniqueFormations(): string[] {
    const tagsInHeader: string[] = this.headerNames.filter(tag => tag.includes('Tag:'));
    return [...tagsInHeader, TAG_ALL];
  }

  getRowColor(row: any[]): string {
    const tag = this.getFormation(row);
    const item = this.tagColors.find(e => e.tag === tag);
    return item?.color || '#000000';
  }

  getFormation(row: any[]): string {
    return this.headerNames.find((tag, index) => tag.includes('Tag:') && row[index] && row[index].trim() === 'X') || TAG_ALL;
  }

  getLinearOrientation(row: any[]): Orientation | undefined {
    const strike = this.getCol(row, HeaderNames['Linear Orientation Trend']);
    const dip = this.getCol(row, HeaderNames['Linear Orientation Plunge']);
    if (this.isNumeric(strike) && this.isNumeric(dip)) {
      return { strike: +strike, dip: +dip };
    }
    return undefined;
  }

  getPlanarOrientation(row: any[]): Orientation | undefined {
    const strike = this.getCol(row, HeaderNames['Planar Orientation Strike']);
    const dip = this.getCol(row, HeaderNames['Planar Orientation Dip']);
    if (this.isNumeric(strike) && this.isNumeric(dip)) {
      return { strike: +strike, dip: +dip };
    }
    return undefined;
  }

  getLine(row: any[]): number[][] | undefined {
    let val = this.getCol(row, HeaderNames['Real World Coordinates']);
    if (val?.includes('LINESTRING')) {
      return val.trim()
        .replace('LINESTRING (', '')
        .replace(')', '')
        .split(',')
        .map(p => p.split(' ').map(e => +e));
    }
    return undefined;
  }

  getLatLng(row: any[]): LatLngAlt | undefined {
    const lat = this.getCol(row, HeaderNames.Latitude);
    const lng = this.getCol(row, HeaderNames.Longitude);
    const alt = this.getCol(row, HeaderNames['Altitude(m)']);
    if (lat !== undefined && lng !== undefined) {
      return { lat: +lat, lng: +lng, alt: +alt };
    }
    const line = this.getLine(row);
    if (line[0]) {
      return { lat: line[0][1], lng: line[0][0], alt: 0 };
    }
    return undefined;
  }

  private string2color(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
    }
    const r = (hash & 0xFF0000) >> 16;
    const g = (hash & 0x00FF00) >> 8;
    const b = hash & 0x0000FF;
    return '#' + ('0' + r.toString(16)).slice(-2) + ('0' + g.toString(16)).slice(-2) + ('0' + b.toString(16)).slice(-2);
  }

  initTagColors() {
    this.headerNames.forEach((tag, index) => {
      if (tag.includes('Tag:')) {
        this.addTagColor(tag);
      }
    });
    this.addTagColor(TAG_ALL);
  }

  private addTagColor(tag: string) {
    const storedColors = this.findStoredColor(tag);
    const color = storedColors?.color || this.string2color(tag);
    this.tagColors.push({ tag, color });
  }

  saveColors(): void {
    const store = JSON.stringify(this.tagColors);
    localStorage.setItem(STORAGE_COLOR_KEY, store);
  }

  setStoredColors(): void {
    const res = localStorage.getItem(STORAGE_COLOR_KEY);
    if (res) {
      this.storedColors = <TagColor[]>JSON.parse(res);
    }
  }

  findStoredColor(tagName: string): TagColor | undefined {
    if (!this.storedColors.length) {
      this.setStoredColors();
    }
    return this.storedColors.find(e => e.tag === tagName);
  }

}
