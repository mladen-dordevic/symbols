import { HeaderNames } from 'src/app/enum/header-names.enum';
import { Colors } from 'src/app/enum/colors.enum';
import { DipDirection } from 'src/app/enum/dip-direction.enum';

export class TableCSV {
  headerNames = [
    'Name for Point',
    'Longitude',
    'Latitude',
    'Unit/Formation',
    'Symbol Type',
    'Symbol Color',
    'Strike or Trend',
    'Dip or Plunge',
    'Dip Direction',
    'Notes/Observation',
  ];

  isNumeric(val: any): boolean {
    const test = parseFloat(val);
    return !isNaN(test) && isFinite(test);
  }

  rawData: string;
  data: [][] = [];
  headerOrder = [];

  private initHeaderOrder(length: number = +Infinity) {
    this.headerOrder = this.headerNames.map((e, i) => i).filter((e, i) => i < length);
  }

  setData(data: any) {
    this.data = data;
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
      case HeaderNames.Strike:
        return this.isNumeric(value) && +value >= 0 && +value < 360;
      case HeaderNames.Dip:
        return this.isNumeric(value) && +value >= 0 && +value <= 90;
      case HeaderNames.Color:
        return Colors[value] !== undefined;
      case HeaderNames.DipDirection:
        return DipDirection[value.toUpperCase()] !== undefined;
      default:
        return null;
    }
  }

  getUniqColor() {
    return this.data.reduce((acc, row) => {
      const color = this.getCol(row, HeaderNames.Color);
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
    const formations = {};
    for (let row of this.data) {
      const formationName = this.getCol(row, HeaderNames.Formation);
      if (formationName) {
        formations[formationName] = true;
      }
    }
    return Object.keys(formations);
  }

  getFormation(row: any[]): string {
    return this.getCol(row, HeaderNames.Formation);
  }

  getStrike(row: any[]): number | undefined {
    const strikeDirty = this.getCol(row, HeaderNames.Strike);
    const strikeAdjustment = this.dipDirectionAdjustment(row);
    return (strikeDirty === '' || strikeDirty === undefined) ? undefined : ((+strikeDirty + strikeAdjustment) % 360);
  }

  dipDirectionAdjustment(row: any): number {
    const dd = this.getCol(row, HeaderNames.DipDirection)
    if (!dd) {
      return 0;
    }
    const dipDirection: DipDirection = <any>DipDirection[dd.toUpperCase()];
    const s = +this.getCol(row, HeaderNames.Strike);

    if (s >= 0 && s < 90 && [DipDirection.W, DipDirection.N, DipDirection.NW].indexOf(dipDirection) > -1) { return 180; }
    if (s >= 90 && s < 180 && [DipDirection.N, DipDirection.E, DipDirection.NE].indexOf(dipDirection) > -1) { return 180; }
    if (s >= 180 && s < 270 && [DipDirection.S, DipDirection.E, DipDirection.SE].indexOf(dipDirection) > -1) { return 180; }
    if (s >= 270 && s < 360 && [DipDirection.S, DipDirection.W, DipDirection.SW].indexOf(dipDirection) > -1) { return 180; }
    return 0;
  }

  getDip(row: any[]): number | undefined {
    const dipDirty = this.getCol(row, HeaderNames.Dip);
    return (dipDirty === '' || dipDirty === undefined) ? undefined : +dipDirty;
  }

}
