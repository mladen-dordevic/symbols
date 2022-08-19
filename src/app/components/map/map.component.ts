import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { IconService } from 'src/app/services/icon.service';
import { Papa } from 'ngx-papaparse';
import { saveAs } from 'file-saver';
import { HeaderNames } from 'src/app/enum/header-names.enum';
import { KmlService } from 'src/app/services/kml.service';
import { TableCSV } from 'src/app/models/table-csv';
import { KMLServiceOptions } from 'src/app/models/kmlservice-options';
import { VERSION } from '@env/version';

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

  fileChangeListener($event: any): void {
    const files = $event.srcElement.files;
    this.papa.parse(files[0], {
      complete: (result) => {
        this.csvRecords.setData(result.data);
      }
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
    return lat !== 0 && isNaN(lat) === false && lng !== 0 && isNaN(lng) === false;
  }

  createMarker(row: any[]) {
    const color = this.csvRecords.getCol(row, HeaderNames.Color);
    const strike = +this.csvRecords.getStrike(row);
    const dip = +this.csvRecords.getCol(row, HeaderNames.Dip);
    const position = {
      lat: +this.csvRecords.getCol(row, HeaderNames.Latitude),
      lng: +this.csvRecords.getCol(row, HeaderNames.Longitude)
    };
    const marker = new google.maps.Marker({
      position,
      icon: {
        url: this.iconService.strikeDit(strike, dip, color),
        anchor: new google.maps.Point(15, 15)
      },
      map: this.map,
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
