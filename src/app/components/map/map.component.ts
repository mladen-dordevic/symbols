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
import { Colors } from 'src/app/enum/colors.enum';

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

  csvRecords: TableCSV

  headerOrder = [];
  header = [];
  tagColors = [];
  availableColors = Colors;
  symbolLength = 50;
  symbolHeight = 25;
  lineWidth = 6;
  createFolders = false;
  symbolElevation = this.symbolLength;
  fileName = 'data';

  constructor(
    private iconService: IconService,
    private papa: Papa,
    public kmlService: KmlService,
    public ref: ChangeDetectorRef
  ) {
    this.csvRecords = new TableCSV();
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

    const colorsTmp = Object.keys(Colors);

    this.header.forEach((key, index) => {
      const randomColor = colorsTmp[Math.floor(colorsTmp.length * Math.random())];
      const detColor = colorsTmp[this.tagColors.length];
      if (key.includes('Tag:')) {
        this.tagColors.push({
          tag: key,
          color: randomColor
        });
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
    // const color = this.csvRecords.getCol(row, HeaderNames['Symbol Color']);
    let strike = this.csvRecords.getCol(row, HeaderNames['Planar Orientation Strike']);
    let dip = this.csvRecords.getCol(row, HeaderNames['Planar Orientation Dip']);
    let url = null;
    const color = this.getRowColor(row);
    if (strike !== undefined && dip !== undefined) {
      url = this.iconService.strikeDit(+strike, +dip, color);
    } else {
      strike = this.csvRecords.getCol(row, HeaderNames['Linear Orientation Trend']);
      dip = this.csvRecords.getCol(row, HeaderNames['Linear Orientation Plunge']);

      if (strike !== undefined && dip !== undefined) {
        url = this.iconService.trendPlunge(+strike, +dip, color);
      } else {
        url = this.iconService.circleIcon(color);
      }
    }


    const position = {
      lat: +this.csvRecords.getCol(row, HeaderNames.Latitude),
      lng: +this.csvRecords.getCol(row, HeaderNames.Longitude)
    };
    const marker = new google.maps.Marker({
      position,
      icon: {
        url,
        anchor: new google.maps.Point(15, 15)
      },
      map: this.map,
      title: this.csvRecords.getCol(row, HeaderNames.Notes),
      strike,
      dip,
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
    this.map.fitBounds(bounds, { top: 5, bottom: 5, left: 5, right: 5 });
  }

  export() {
    const doc = this.kmlService.get(this.csvRecords, {
      documentName: this.fileName,
      symbolLength: this.symbolLength,
      symbolHeight: this.symbolHeight,
      lineWidth: this.lineWidth,
      createFolders: this.createFolders
    });
    var blob = new Blob([doc], { type: "text/plain;charset=utf-8" });
    saveAs(blob, this.fileName + '.kml');
  }
}
