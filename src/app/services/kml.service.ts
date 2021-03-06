import { Injectable } from '@angular/core';
import { HeaderNames } from '../enum/header-names.enum';
import { Colors } from '../enum/colors.enum';
import { TableCSV } from '../models/table-csv';
import { KMLServiceOptions } from '../models/kmlservice-options';

declare var google;

@Injectable({
  providedIn: 'root'
})
export class KmlService {
  private options: KMLServiceOptions
  private csvRecords: TableCSV
  private labelCoords = '';

  constructor() { }

  public get(csvRecords: TableCSV, options?: KMLServiceOptions): string {
    this.csvRecords = csvRecords
    this.options = Object.assign(this.defaultOptions(), options);
    const styles = this.createStyles();

    const content = this.options.createFolders ?
      this.generateFolderString() :
      this.generatePlacemarkString(this.csvRecords.data);

    return this.createDocument(styles + content, this.options.documentName);
  }

  private defaultOptions(): KMLServiceOptions {
    const options = new KMLServiceOptions();
    options.symbolHeight = 50;
    options.symbolLength = 50;
    options.lineWidth = 6;
    options.documentName = 'file';
    options.createFolders = false;
    return options;
  }

  private generatePlacemarkString(rows: any[]): string {
    return rows.map((row: any, rowIndex: number) => {
      const strike = this.csvRecords.getStrike(row);
      const dip = this.csvRecords.getDip(row);
      return this.createSymbol(
        this.getItemName(row, rowIndex),
        this.generatePopupContent(row),
        this.csvRecords.getCol(row, HeaderNames.Color) || 'black',
        this.generateGeometry(row),
        dip,
        strike
      );
    }).join('');
  }

  private generateFolderString(): string {
    return this.csvRecords.getUniqueFormations().map(formation => {
      const currentFormationRows = this.csvRecords.data.filter((row: any[]) => {
        return this.csvRecords.getCol(row, HeaderNames.Formation) === formation;
      });
      return this.createFolder(formation, '0', this.generatePlacemarkString(currentFormationRows));
    }).join('');
  }

  private generatePopupContent(row: any[]): string {
    const formation = this.csvRecords.getFormation(row);
    const notes = this.csvRecords.getCol(row, HeaderNames.Observations);
    const dip = this.csvRecords.getDip(row);
    const strike = this.csvRecords.getStrike(row);
    const type = this.csvRecords.getCol(row, HeaderNames.Type);

    const dipLabel = type === 'lineation' ? 'Plunge' : 'Dip';
    const strikeLabel = type === 'lineation' ? 'Trend' : 'Strike';

    return [
      formation ? `Unit: ${formation}` : false,
      strike === undefined ? false : `${strikeLabel}: ${strike}&deg;`,
      dip === undefined ? false : `${dipLabel}: ${dip}&deg;`,
      notes ? `<hr>Notes: ${notes}` : false
    ].filter(e => e).join('<br>')
  }


  private getItemName(row: any[], rowIndex: number): string {
    const formation = this.csvRecords.getFormation(row) + '-' + rowIndex;
    const name = this.csvRecords.getCol(row, HeaderNames.Name);
    return name || formation;
  }


  private generateGeometry(row: any[]): string {
    const type = this.csvRecords.getCol(row, HeaderNames.Type);
    const lat = +this.csvRecords.getCol(row, HeaderNames.Latitude);
    const lng = +this.csvRecords.getCol(row, HeaderNames.Longitude);
    const strike = this.csvRecords.getStrike(row);
    const dip = this.csvRecords.getDip(row);


    if (strike === undefined && dip === undefined) {
      return `<Point><coordinates>${lng},${lat},${this.options.symbolLength / 2}</coordinates></Point>`;
    }

    switch (type.toLowerCase()) {
      case 'bedding':
        if (dip === 90) {
          return this.generateStrikeDip90Geometry(lat, lng, dip, strike);
        }
        if (dip === 0) {
          return this.generateStrikeDip0Geometry(lat, lng, dip, strike);
        }
        return this.generateStrikeDipGeometry(lat, lng, dip, strike);
      case 'foliation':
        return this.generateFoliationGeometry(lat, lng, dip, strike);
      case 'lineation':
        return this.generateLineationGeometry(lat, lng, dip, strike);
      default:
        return `<Point><coordinates>${lng},${lat},${this.options.symbolLength / 2}</coordinates></Point>`;
    }

  }

  private createStyles(): string {
    const colors = this.csvRecords.getUniqColor();
    const noIcon = '<Style id="sn_no_icon"><IconStyle><Icon></Icon></IconStyle><LabelStyle>		<scale>1.0</scale></LabelStyle></Style>';
    return noIcon + colors.map(color => this.createStyle(color)).join('');
  }

  private colorName2aabbggrr(colorName: string): string {
    const rgb = Colors[colorName];
    const p = rgb.split('');
    return ['ff', p[4], p[5], p[2], p[3], p[0], p[1]].join('');
  }

  private createStyle(color: string): string {
    return `<Style id="_${color}">
      <LineStyle>
        <color>${this.colorName2aabbggrr(color)}</color>
        <width>${this.options.lineWidth}</width>
      </LineStyle>
    </Style>
    <Style id="_dot_${color}">
      <IconStyle>
        <scale>1.2</scale>
        <color>${this.colorName2aabbggrr(color)}</color>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>00ffffff</color>
      </LabelStyle>
    </Style>`;
  }

  private createDocument(content: string, name: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <!-- Orientation symbols generated by Symbols tool, written by Mladen Dordevic and Steve Whitmeyer Symbols: http://csmgeo.csm.jmu.edu/Geollab/Whitmeyer/geode/symbols/ -->
    <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"><Document><name>${name}</name><open>1</open>${content}
  </Document></kml>`;
  }

  private createSymbol(name: string, description: string, color: string, geometry: string, dip: number | undefined, strike: number | undefined): string {
    const label = this.createLabel(dip);
    const noIcon = (dip === strike && dip === undefined) ? 'dot_' : '';
    return `<Placemark>
        <name>${name}</name>
        <description><![CDATA[${description}]]></description>
        <styleUrl>#_${noIcon}${color}</styleUrl>
        ${geometry}

      </Placemark>${label}
      `;
  }

  private createLabel(dip: number | undefined): string {
    return dip ? `<Placemark>
      <name>${dip}</name>
      <styleUrl>#sn_no_icon</styleUrl>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${this.labelCoords}</coordinates>
      </Point>
    </Placemark>`: '';
  }

  private createFolder(folderName: string, open = '0', content: string): string {
    return `<Folder>
      <name>${folderName}</name>
      <open>${open}</open>
      ${content}
    </Folder>`
  }

  private generateStrikeDipGeometry(lat: number, lng: number, dip: number, strike: number): string {
    const unit = this.options.symbolLength / 2;
    const pm = new google.maps.LatLng(lat, lng);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, unit, strike);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, unit, strike + 180);
    const p3 = google.maps.geometry.spherical.computeOffset(pm, unit / 2 * Math.cos(dip * Math.PI / 180), strike + 90);

    const alt = this.options.symbolHeight - unit / 2 * Math.sin(dip * Math.PI / 180);
    this.labelCoords = `${p3.lng()},${p3.lat()},${alt}`;

    return this.createMultiGeometry([
      this.createLinearString([
        [p1.lng(), p1.lat(), this.options.symbolHeight],
        [pm.lng(), pm.lat(), this.options.symbolHeight],
        [p3.lng(), p3.lat(), alt],
        [pm.lng(), pm.lat(), this.options.symbolHeight],
        [p2.lng(), p2.lat(), this.options.symbolHeight]
      ])
    ]);

  }

  // Crossed circle with only a strike, same height
  private generateStrikeDip0Geometry(lat: number, lng: number, dip: number, strike: number): string {
    const unit = this.options.symbolLength / 2;
    const pm = new google.maps.LatLng(lat, lng);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, unit, strike);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, unit, strike + 90);
    const p3 = google.maps.geometry.spherical.computeOffset(pm, unit, strike + 180);
    const p4 = google.maps.geometry.spherical.computeOffset(pm, unit, strike + 270);

    let circles = [];
    for (let step = 0; step <= 360; step += 10) {
      circles.push(google.maps.geometry.spherical.computeOffset(pm, unit, strike + step));
    }

    circles = circles.map(c => [c.lng(), c.lat(), this.options.symbolHeight]);

    return this.createMultiGeometry([
      this.createLinearString([
        [p1.lng(), p1.lat(), this.options.symbolHeight],
        [p3.lng(), p3.lat(), this.options.symbolHeight]
      ]),
      this.createLinearString([
        [p2.lng(), p2.lat(), this.options.symbolHeight],
        [p4.lng(), p4.lat(), this.options.symbolHeight]
      ]),
      this.createLinearString(circles)
    ]);
  }

  private generateStrikeDip90Geometry(lat: number, lng: number, dip: number, strike: number): string {
    const unit = this.options.symbolLength / 2;
    const pm = new google.maps.LatLng(lat, lng);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, unit, strike);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, unit, strike + 180);


    const p1a = google.maps.geometry.spherical.computeOffset(pm, unit / 2, strike + 90);
    const p2a = google.maps.geometry.spherical.computeOffset(pm, unit / 2, strike + 270);

    return this.createMultiGeometry([
      this.createLinearString([
        [p1.lng(), p1.lat(), this.options.symbolHeight],
        [p2.lng(), p2.lat(), this.options.symbolHeight]
      ]),
      this.createLinearString([
        [p1a.lng(), p1a.lat(), this.options.symbolHeight],
        [p2a.lng(), p2a.lat(), this.options.symbolHeight]
      ]),
      this.createLinearString([
        [pm.lng(), pm.lat(), this.options.symbolHeight],
        [pm.lng(), pm.lat(), this.options.symbolHeight - unit / 2]
      ])
    ]);
  }

  // Line
  private generateFoliationGeometry(lat: number, lng: number, dip: number, strike: number): string {
    const unit = this.options.symbolLength / 2;
    const pm = new google.maps.LatLng(lat, lng);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, unit, strike);
    const p1a = google.maps.geometry.spherical.computeOffset(pm, unit / 2, strike);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, unit, strike + 180);
    const p2a = google.maps.geometry.spherical.computeOffset(pm, unit / 2, strike + 180);
    const p3 = google.maps.geometry.spherical.computeOffset(pm, unit / 2 * Math.cos(dip * Math.PI / 180), strike + 90);

    const alt = this.options.symbolHeight - unit / 2 * Math.sin(dip * Math.PI / 180);
    this.labelCoords = `${p3.lng()},${p3.lat()},${alt}`;


    return this.createLinearString([
      [p1.lng(), p1.lat(), this.options.symbolHeight],
      [p1a.lng(), p1a.lat(), this.options.symbolHeight],
      [p3.lng(), p3.lat(), alt],
      [p2a.lng(), p2a.lat(), this.options.symbolHeight],
      [p1a.lng(), p1a.lat(), this.options.symbolHeight],
      [p2a.lng(), p2a.lat(), this.options.symbolHeight],
      [p2.lng(), p2.lat(), this.options.symbolHeight]
    ]);
  }

  // Line with the arrow at one end
  private generateLineationGeometry(lat: number, lng: number, dip: number, strike: number): string {
    const unit = this.options.symbolLength / 4;
    const pm = new google.maps.LatLng(lat, lng);
    const f = Math.cos(dip * Math.PI / 180);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, f * unit, strike + 0);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, f * unit, strike + 180);
    const pArr = google.maps.geometry.spherical.computeOffset(pm, f * unit * 0.7, strike + 0);
    const p2a = google.maps.geometry.spherical.computeOffset(pArr, f * unit * 0.1, strike - 90);
    const p2b = google.maps.geometry.spherical.computeOffset(pArr, f * unit * 0.1, strike + 90);

    const alt = Math.sin(dip * Math.PI / 180);
    this.labelCoords = `${p1.lng()},${p1.lat()},${this.options.symbolHeight - unit * alt}`;

    return this.createMultiGeometry([
      this.createLinearString([
        [p1.lng(), p1.lat(), this.options.symbolHeight - unit * alt],
        [p2.lng(), p2.lat(), this.options.symbolHeight + unit * alt]
      ]),
      this.createLinearString([
        [p2a.lng(), p2a.lat(), this.options.symbolHeight - unit * 0.7 * alt],
        [p1.lng(), p1.lat(), this.options.symbolHeight - unit * alt],
        [p2b.lng(), p2b.lat(), this.options.symbolHeight - unit * 0.7 * alt]
      ])
    ])
  }

  private createLinearString(coords: any[], altitudeMode = 'relativeToGround'): string {
    return `<LineString>
      <tesselate>1</tesselate>
      <altitudeMode>${altitudeMode}</altitudeMode>
      <coordinates>${coords.map(e => e.join(',')).join(' ')}
      </coordinates>
    </LineString>`;
  }

  private createMultiGeometry(linearString: any[]): string {
    return `<MultiGeometry>${linearString.join('')}</MultiGeometry>`
  }
}
