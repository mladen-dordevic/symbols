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
  masterColor = '#000000';
  defaultColors = [];
  showMap = false;

  csvRecords: TableCSV;
  kmlOptions: KMLServiceOptions;

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
    if (!file) {
      return;
    }
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

    const out = [];
    const header = json.shift();
    const keys = Object.keys(header);
    const headerNames = Object.values(header);

    this.csvRecords.setHeader(headerNames);

    out.push(headerNames);

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
          // check if StraboSpot produced scv
          let headerNames;
          if (result.data[0][0].includes('StraboSpot')) {
            headerNames = result.data[3];
          } else {
            headerNames = Object.values(HeaderNames);
            // Does the first 5 column have tag data
            const tags = [];
            for (let i = 0; i < 5 && i < result.data.length; i++) {
              const row = result.data[i];
              row.forEach(tag => {
                if (tag.includes('Tag:')) {
                  tags.push(tag);
                }
              });
            }
            if (tags.length === 0) {
              for (let i = 0; i < 20; i++) {
                headerNames.push(`Tag:Unit ${i}`);
              }
            }

            headerNames = [...headerNames, ...tags];
          }
          this.csvRecords.setHeader(headerNames);
          resolve(result.data);
        }
      })
    });
  }

  masterColorChange(event): void {
    console.log(event);
    this.csvRecords.tagColors.forEach(row => row.color = event);
  }

  resetDefaultColors() {
    this.csvRecords.tagColors.forEach(row => {
      row.color = this.csvRecords.string2color(row.tag);
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


  createMarker(row: any[]) {
    const position = this.csvRecords.getLatLng(row);
    const planarOrientation = this.csvRecords.getPlanarOrientation(row);
    const linearOrientation = this.csvRecords.getLinearOrientation(row);
    const color = this.csvRecords.getRowColor(row);
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

  async export() {
    const doc = await this.kmlService.get(this.csvRecords, this.kmlOptions);
    var blob = new Blob([doc], { type: "text/plain;charset=utf-8" });
    saveAs(blob, this.kmlOptions.documentName + '.kml');
    this.csvRecords.saveColors();
  }


}
