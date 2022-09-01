import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { IconService } from 'src/app/services/icon.service';
import { Papa } from 'ngx-papaparse';
import { saveAs } from 'file-saver';
import { HeaderNames } from 'src/app/enum/header-names.enum';
import { KmlService } from 'src/app/services/kml.service';
import { TableCSV } from 'src/app/models/table-csv';
import { KMLServiceOptions } from 'src/app/models/kmlservice-options';
import { VERSION } from '@env/version';
import { read, utils } from 'xlsx';

const STORAGE_COLOR_KEY = 'color-storage';
export interface TagColor {
  tag: string;
  color: string;
}

declare var google;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {
  @ViewChild('map', { static: true }) mapElement: ElementRef;
  @ViewChild('fileImportInput', { static: false }) fileImportInput: any;
  map: any;
  version = VERSION
  markers = [];

  dip = 0;
  strike = 0;
  selected = null;
  showMap = false;

  csvRecords: TableCSV;
  kmlOptions: KMLServiceOptions;
  headerOrder = [];
  header = [];
  tagColors: TagColor[] = [];
  storedColors: TagColor[] = [];

  constructor(
    private iconService: IconService,
    private papa: Papa,
    public kmlService: KmlService,
    public ref: ChangeDetectorRef
  ) {
    this.csvRecords = new TableCSV();
    this.kmlOptions = new KMLServiceOptions();
  }

  ngOnInit(): void {
    this.map = new google.maps.Map(this.mapElement.nativeElement, {
      zoom: 6,
      center: new google.maps.LatLng(5, 5),
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.RIGHT_TOP
      },
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false
    });
  }

  update() {
    this.selected.dip = +this.dip
    this.selected.strike = +this.strike
    this.selected.setIcon({
      url: this.iconService.strikeDit(+this.strike, +this.dip, this.selected.color),
      anchor: new google.maps.Point(15, 15)
    })
  }

  async fileChangeListener($event: any): Promise<void> {
    const file: File = $event.srcElement.files[0];
    console.log(file);
    let res = null;
    if (file.type === 'text/csv') {
      res = await this.parseCSV(file);
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      res = await this.parseXLS(file);
    }

    this.csvRecords.setData(res);
  }

  async parseXLS(file: File): Promise<any> {
    const arrayBuffer = await file.arrayBuffer();
    const worksheet = read(arrayBuffer);
    const json: any[][] = utils.sheet_to_json(worksheet.Sheets.Spots);

    const header = json.shift();
    const keys = Object.keys(header);
    this.header = Object.values(header);

    const out = [];
    out.push(this.header);

    this.header.forEach((tag, index) => {
      if (tag.includes('Tag:')) {
        const storedColors = this.findStoredColor(tag);
        const color = storedColors?.color || this.string2color(tag);
        this.tagColors.push({ tag, color });
      }
    });

    this.csvRecords.tagColors = this.tagColors;

    json.forEach(row => {
      const rowOut = Array(keys.length);
      keys.forEach((key, index) => {
        if (key in row) {
          rowOut[index] = row[key];
        }
      });
      out.push(rowOut);
    })
    return out;
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

  parseCSV(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      this.papa.parse(file, {
        complete: (result) => {
          resolve(result.data);
        }
      })
    });
  }

  validateCell(value: any, colIndex: number): string {
    const val = this.validateCellType(value, colIndex);
    if (val === null) {
      return 'gray';
    }
    return val ? 'green' : 'red';
  }

  validateCellType(value: any, colIndex: number): boolean | null {
    return this.csvRecords.validateCellType(value, colIndex);
  }

  removeRow(index: number): void {
    this.csvRecords.data.splice(index, 1);
  }

  removeColumn(index: number): void {
    if (!confirm('Delete column?')) { return; }
    this.csvRecords.data.forEach(row => row.splice(index, 1));
    this.csvRecords.headerOrder.splice(index, 1);
  }

  tabSwitched(event) {
    if (event === 1 && this.csvRecords.data.length) {
      this.updateMap();
    }
  }

  cleanEmptyElements(): any[] {
    return this.csvRecords.data.filter(row => this.invalidRow(row));
  }

  autoRemoveEmptyElements(): void {
    this.csvRecords.data = this.cleanEmptyElements();
  }

  invalidRow(row): boolean {
    const lat = +this.csvRecords.getCol(row, HeaderNames.Latitude);
    const lng = +this.csvRecords.getCol(row, HeaderNames.Longitude);

    const strikeTrend = this.csvRecords.getCol(row, HeaderNames['Planar Orientation Strike']) !== undefined || this.csvRecords.getCol(row, HeaderNames['Linear Orientation Trend']) !== undefined;
    return lat !== 0 && isNaN(lat) === false && lng !== 0 && isNaN(lng) === false;
  }

  getRowColor(row: any[]): string {
    const tag = this.header.find((tag, index) => {
      return tag.includes('Tag:') && row[index] && row[index].trim() === 'X'
    });
    const tagColor = this.tagColors.find(e => e.tag === tag);
    return tagColor?.color || 'red';
  }

  createMarker(row: any[]) {
    const position = this.csvRecords.getLatLng(row);
    const planarOrientation = this.csvRecords.getPlanarOrientation(row);
    const linearOrientation = this.csvRecords.getLinearOrientation(row);
    const color = this.getRowColor(row);
    let url = this.iconService.circleIcon(color);
    if (planarOrientation) {
      url = this.iconService.strikeDit(planarOrientation.strike, planarOrientation.dip, color);
    }
    if (linearOrientation) {
      url = this.iconService.trendPlunge(linearOrientation.strike, linearOrientation.dip, color);
    }

    const marker = new google.maps.Marker({
      position,
      icon: {
        url,
        anchor: new google.maps.Point(15, 15)
      },
      map: this.map,
      title: this.csvRecords.getCol(row, HeaderNames.Notes),
      strike: planarOrientation?.strike || linearOrientation?.strike || undefined,
      dip: planarOrientation?.dip || linearOrientation?.dip || undefined,
      color,
      row
    });

    marker.addListener('click', () => {
      this.dip = marker.dip;
      this.strike = marker.strike;
      this.selected = marker;
    });
    return marker;
  }

  updateMap() {
    this.showMap = true;
    this.markers.forEach(m => m.setMap(null));
    const bounds = new google.maps.LatLngBounds();

    this.markers = this.csvRecords.data.filter(row => this.invalidRow(row)).map(row => {
      const marker = this.createMarker(row);
      bounds.extend(marker.getPosition());
      return marker;
    });
    setTimeout(() => {
      this.map.fitBounds(bounds, { top: 5, bottom: 5, left: 5, right: 5 });
    }, 300);
  }

  export() {
    const doc = this.kmlService.get(this.csvRecords, this.kmlOptions);
    var blob = new Blob([doc], { type: "text/plain;charset=utf-8" });
    saveAs(blob, this.kmlOptions.documentName + '.kml');
    this.saveColors();
  }

  saveColors(): void {
    const store = JSON.stringify(this.csvRecords.tagColors);
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
