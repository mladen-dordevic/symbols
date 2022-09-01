import { HeaderNames } from 'src/app/enum/header-names.enum';

export class TableCSV {
  // headerNames = Object.keys(HeaderNames).filter((v) => isNaN(Number(v)));
  headerNames = [];
  headerOrder = [];
  tagColors;
  rawData: string;
  data: [][] = [];

  isNumeric(val: any): boolean {
    const test = parseFloat(val);
    return !isNaN(test) && isFinite(test);
  }

  private initHeaderOrder(length: number = +Infinity) {
    this.headerOrder = this.headerNames.map((e, i) => i).filter((e, i) => i < length);
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
    return this.headerNames.filter(tag => tag.includes('Tag:'));
  }

  getRowColor(row: any[]): string {
    const tag = this.getFormation(row);
    const item = this.tagColors.find(e => e.tag === tag);
    return item?.color || '#000000';
  }

  getFormation(row: any[]): string {
    return this.headerNames.find((tag, index) => tag.includes('Tag:') && row[index] && row[index].trim() === 'X');
  }

  getLinearOrientation(row: any[]): { strike: number, dip: number } | undefined {
    const strike = this.getCol(row, HeaderNames['Linear Orientation Trend']);
    const dip = this.getCol(row, HeaderNames['Linear Orientation Plunge']);
    if (this.isNumeric(strike) && this.isNumeric(dip)) {
      return { strike: +strike, dip: +dip };
    }
    return undefined;
  }

  getPlanarOrientation(row: any[]): { strike: number, dip: number } | undefined {
    const strike = this.getCol(row, HeaderNames['Planar Orientation Strike']);
    const dip = this.getCol(row, HeaderNames['Planar Orientation Dip']);
    if (this.isNumeric(strike) && this.isNumeric(dip)) {
      return { strike: +strike, dip: +dip };
    }
    return undefined;
  }

  getLine(row: any[]): number[][] | undefined {
    let val = this.getCol(row, HeaderNames['Real World Coordinates']);
    if (val.includes('LINESTRING')) {
      return val.trim()
        .replace('LINESTRING (', '')
        .replace(')', '')
        .split(',')
        .map(p => p.split(' ').map(e => +e));
    }
    return undefined;
  }

  getLatLng(row: any[]): { lat: number, lng: number } | undefined {
    const lat = this.getCol(row, HeaderNames.Latitude);
    const lng = this.getCol(row, HeaderNames.Longitude);
    if (lat !== undefined && lng !== undefined) {
      return { lat: +lat, lng: +lng };
    }
    const line = this.getLine(row);
    if (line[0]) {
      return { lat: line[0][1], lng: line[0][0] };
    }
    return undefined;
  }
}
