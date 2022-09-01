export class KMLServiceOptions {
  symbolLength: number
  symbolHeight: number
  lineWidth: number;
  groupTags: boolean;
  groupGeometry: boolean
  documentName: string;
  useAltitude: boolean;

  constructor() {
    this.symbolLength = 50;
    this.symbolHeight = 25;
    this.lineWidth = 6;
    this.groupTags = false;
    this.groupGeometry = false;
    this.documentName = 'data';
    this.useAltitude = false
  }
}
