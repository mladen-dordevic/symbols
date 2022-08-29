import { HeaderNames } from 'src/app/enum/header-names.enum';
import { Colors } from 'src/app/enum/colors.enum';
import { DipDirection } from 'src/app/enum/dip-direction.enum';

export class TableCSV {
  // headerNames = Object.keys(HeaderNames).filter((v) => isNaN(Number(v)));
  headerNames = [];
  headerOrder = [];
  tagColors;

  isNumeric(val: any): boolean {
    const test = parseFloat(val);
    return !isNaN(test) && isFinite(test);
  }

  rawData: string;
  data: [][] = [];


  private initHeaderOrder(length: number = +Infinity) {
    this.headerOrder = this.headerNames.map((e, i) => i).filter((e, i) => i < length);
  }

  setData(data: any) {
    this.data = data;
    this.headerNames = [...data[0]];
    this.initHeaderOrder(this.data[0].length);
  }

  getCol(row: any[], index: HeaderNames): string {
    return row[this.headerOrder.indexOf(index)];
  }

  validateCellType(value: any, colIndex: number): boolean | null {
    const type = this.headerOrder[colIndex];
    switch (type) {
      case HeaderNames.Longitude:
        return this.isNumeric(value) && +value >= -180 && +value <= 180;
      case HeaderNames.Latitude:
        return this.isNumeric(value) && +value >= -90 && +value <= 90;
      case HeaderNames['Planar Orientation Strike']:
        return this.isNumeric(value) && +value >= 0 && +value < 360;
      case HeaderNames['Planar Orientation Dip']:
        return this.isNumeric(value) && +value >= 0 && +value <= 90;
      case HeaderNames['Symbol Color']:
        return Colors[value] !== undefined;
      case HeaderNames['Planar Orientation Facing']:
        return typeof (value) === 'string' && DipDirection[value.toUpperCase()] !== undefined;
      default:
        return null;
    }
  }

  getUniqColor() {
    return this.data.reduce((acc, row) => {
      const color = this.getCol(row, HeaderNames['Symbol Color']);
      if (color) {
        const res = acc.indexOf(color) === -1 ? true : false;
        if (res) {
          acc.push(color);
        }
      }
      return acc;
    }, ['black']);
  }

  getUniqueFormations(): string[] {
    return this.headerNames.filter(tag => tag.includes('Tag:'));
  }

  getRowColor(row: any[]): string {
    const tag = this.getFormation(row);
    const item = this.tagColors.find(e => e.tag === tag);
    return item?.color || 'black';
  }

  getFormation(row: any[]): string {
    return this.headerNames.find((tag, index) => tag.includes('Tag:') && row[index] && row[index].trim() === 'X');
  }

  getStrike(row: any[]): number | undefined {
    const strikeDirty = this.getCol(row, HeaderNames['Planar Orientation Strike']);
    const strikeAdjustment = this.dipDirectionAdjustment(row);
    return (strikeDirty === '' || strikeDirty === undefined) ? undefined : ((+strikeDirty + strikeAdjustment) % 360);
  }

  dipDirectionAdjustment(row: any): number {
    const dd = this.getCol(row, HeaderNames['Planar Orientation Facing'])
    if (!dd) {
      return 0;
    }
    const dipDirection: DipDirection = <any>DipDirection[dd.toUpperCase()];
    const s = +this.getCol(row, HeaderNames['Planar Orientation Strike']);

    if (s >= 0 && s < 90 && [DipDirection.W, DipDirection.N, DipDirection.NW].indexOf(dipDirection) > -1) { return 180; }
    if (s >= 90 && s < 180 && [DipDirection.N, DipDirection.E, DipDirection.NE].indexOf(dipDirection) > -1) { return 180; }
    if (s >= 180 && s < 270 && [DipDirection.S, DipDirection.E, DipDirection.SE].indexOf(dipDirection) > -1) { return 180; }
    if (s >= 270 && s < 360 && [DipDirection.S, DipDirection.W, DipDirection.SW].indexOf(dipDirection) > -1) { return 180; }
    return 0;
  }

  getDip(row: any[]): number | undefined {
    const dipDirty = this.getCol(row, HeaderNames['Planar Orientation Dip']);
    return (dipDirty === '' || dipDirty === undefined) ? undefined : +dipDirty;
  }

}
