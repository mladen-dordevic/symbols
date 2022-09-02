import { Injectable } from '@angular/core';
import { HeaderNames } from '../enum/header-names.enum';
import { LatLngAlt, Orientation, TableCSV } from '../models/table-csv';
import { KMLServiceOptions } from '../models/kmlservice-options';

enum BalloonLines {
  FORMATION,
  PLANAR_FEATURE,
  PLANAR_ORIENTATION_STRIKE,
  PLANAR_ORIENTATION_DIP,
  PLANAR_QUALITY,
  PLANAR_FACING,
  LINEAR_FEATURE,
  LINEAR_ORIENTATION_TREND,
  LINEAR_ORIENTATION_PLUNGE,
  DATE,
  NOTES,
}

interface GoogleElevationApiResponse {
  results: GoogleElevationApiResponseDataItem[];
  status: GoogleElevationApiResponseStatus;
  error_message?: string;
}

interface GoogleElevationApiResponseDataItem {
  elevation: number;
  location: { lat: number, lng: number };
  resolution: number;
}

type GoogleElevationApiResponseStatus = 'OK' |
  'DATA_NOT_AVAILABLE' |
  'INVALID_REQUEST' |
  'OVER_DAILY_LIMIT' |
  'OVER_QUERY_LIMIT' |
  'REQUEST_DENIED' |
  'UNKNOWN_ERROR';

type AltitudeMode = 'clampToGround' | 'relativeToGround' | 'absolute';

declare var google;

@Injectable({
  providedIn: 'root'
})
export class KmlService {
  private options: KMLServiceOptions
  private csvRecords: TableCSV
  private labels: string[] = [];
  private rowAltitudeMod: AltitudeMode;
  constructor() {
    this.options = new KMLServiceOptions();
  }

  public async get(csvRecords: TableCSV, options?: KMLServiceOptions): Promise<string> {
    this.csvRecords = csvRecords
    this.options = Object.assign(this.options, options);
    const styles = this.createStyles();

    if (this.options.useAltitude && this.options.googleMapsElevationApi) {
      await this.getElevationDataGoogleService();
    }

    const content = this.options.groupTags ?
      this.generateFolderString() :
      this.generatePlacemarkString(this.csvRecords.data);

    return this.createDocument(styles + content, this.options.documentName);
  }

  private shouldGetElevation(row: any[]): boolean {
    const location = this.csvRecords.getLatLng(row);
    const planarOrientation = this.csvRecords.getPlanarOrientation(row);
    const linearOrientation = this.csvRecords.getLinearOrientation(row);
    return (planarOrientation || linearOrientation) && location && !location.alt && location.lat !== undefined && location.lng !== undefined;
  }

  private async getElevationDataGoogleService() {
    const missingData = this.csvRecords.data.filter(row => this.shouldGetElevation(row)).map(row => this.csvRecords.getLatLng(row));
    if (missingData.length < 500) {
      const locations = missingData.map(row => { return { lat: row.lat, lng: row.lng } });
      const service = new google.maps.ElevationService();
      try {
        const data: GoogleElevationApiResponse = await service.getElevationForLocations({ locations });
        let count = 0;
        this.csvRecords.data.forEach((row, index) => {
          const resItem = data.results[count];
          if (this.shouldGetElevation(row)) {
            const altColumnIndex = this.csvRecords.getColIndex(HeaderNames['Altitude(m)'])
            this.csvRecords[index][altColumnIndex] = resItem.elevation;
            count += 1;
          }
        })
      } catch (error) {
        alert(error);
      }
    }
  }

  private generatePlacemarkString(rows: any[]): string {
    return rows.map((row: any, rowIndex: number) => {
      this.labels = [];
      const latLng = this.csvRecords.getLatLng(row);
      this.rowAltitudeMod = this.getAltitudeMod(latLng);
      return this.createSymbol(
        this.getItemName(row, rowIndex),
        this.generatePopupContent(row),
        this.csvRecords.getRowColor(row),
        this.generateGeometry(row),
        row
      );
    }).join('');
  }

  private generateFolderString(): string {
    return this.csvRecords.getUniqueFormations().map(formation => {
      const currentFormationRows = this.csvRecords.data.filter((row: any[]) => {
        return this.csvRecords.getFormation(row) === formation;
      });
      return this.createFolder(formation, '0', this.generatePlacemarkString(currentFormationRows));
    }).join('');
  }

  private generatePopupContent(row: any[]): string {
    const formation = this.csvRecords.getFormation(row);

    const notes = this.csvRecords.getCol(row, HeaderNames.Notes);
    const date = this.csvRecords.getCol(row, HeaderNames.Date);

    const planarOrientation = this.csvRecords.getPlanarOrientation(row);
    const linearOrientation = this.csvRecords.getLinearOrientation(row);

    const planarFeature = this.csvRecords.getCol(row, HeaderNames['Planar Orientation Planar Feature Type']);
    const planarQuality = this.csvRecords.getCol(row, HeaderNames['Planar Orientation Quality']);
    const planarFacing = this.csvRecords.getCol(row, HeaderNames['Planar Orientation Facing']);

    const linearFeature = this.csvRecords.getCol(row, HeaderNames['Linear Orientation Linear Feature Type']);

    let out = [
      formation ? `Unit: ${formation.replace('Tag:', '')}` : false,
      planarFeature ? `Planar Feature: ${this.titleCase(planarFeature)}` : false,
      planarOrientation ? `Strike: ${planarOrientation.strike}&deg;` : false,
      planarOrientation ? `Dip: ${planarOrientation.dip}&deg;` : false,
      planarQuality ? `Measurement Quality: ${planarQuality}` : false,
      planarFacing ? `Facing: ${planarFacing}` : false,
      linearFeature ? `Linear Feature: ${this.titleCase(linearFeature)}` : false,
      linearOrientation ? `Trend: ${linearOrientation.strike}&deg;` : false,
      linearOrientation ? `Plunge: ${linearOrientation.dip}&deg;` : false,
      date ? `Date UTC: ${date}` : false,
      notes ? `Notes: ${notes}` : false
    ];
    out = this.beforeMeExist(out, BalloonLines.PLANAR_FEATURE);
    out = this.beforeMeExist(out, BalloonLines.LINEAR_FEATURE);
    out = this.beforeMeExist(out, BalloonLines.DATE);
    out = this.beforeMeExist(out, BalloonLines.NOTES);
    return out.filter(e => e).join('<br>')
  }

  private beforeMeExist(entries: any[], index: number): any[] {
    if (!entries[index]) {
      return entries;
    }
    for (let i = 0; i < index; i += 1) {
      if (entries[i] && entries[index]) {
        entries[index] = '<hr>' + entries[index];
        return entries;
      }
    }
    return entries;
  }

  private titleCase(str: string): string {
    return str.split(' ').map(w => {
      return w[0].toUpperCase() + w.substring(1);
    }).join(' ');
  }

  private getItemName(row: any[], rowIndex: number): string {
    const formation = this.csvRecords.getFormation(row) + '-' + rowIndex;
    const name = this.csvRecords.getCol(row, HeaderNames.Name);
    return name || formation;
  }

  private generateGeometry(row: any[]): string {
    const out = [];
    const planarOrientation = this.csvRecords.getPlanarOrientation(row);
    const linearOrientation = this.csvRecords.getLinearOrientation(row);
    const line = this.csvRecords.getLine(row);
    const latLng = this.csvRecords.getLatLng(row);

    if (!planarOrientation && !linearOrientation && !line) {
      out.push(`<Point><coordinates>${latLng.lng},${latLng.lat},${this.options.symbolLength / 2}</coordinates></Point>`);
    }

    if (line) {
      out.push(...this.createLinearString(line, 'clampToGround'));
    }

    if (planarOrientation) {
      if (planarOrientation.dip === 90) {
        out.push(...this.generateStrikeDip90Geometry(latLng, planarOrientation));
      }
      if (planarOrientation.dip === 0) {
        out.push(...this.generateStrikeDip0Geometry(latLng, planarOrientation));
      }
      out.push(...this.generateStrikeDipGeometry(latLng, planarOrientation));
    }
    if (linearOrientation) {
      if (linearOrientation.dip === 90) {
        // out.push(...this.generateStrikeDip90Geometry(latLng, linearOrientation.dip, linearOrientation.strike));
      }
      if (linearOrientation.dip === 0) {
        // out.push(...this.generateStrikeDip0Geometry(latLng, linearOrientation.dip, linearOrientation.strike));
      }
      out.push(...this.generateLineationGeometry(latLng, linearOrientation));
    }
    return this.createMultiGeometry(out);
  }

  private createStyles(): string {
    const tags = [...this.csvRecords.tagColors];
    tags.push({
      color: '#000000',
      tag: 'Default'
    })
    const noIcon = '<Style id="sn_no_icon"><IconStyle><Icon></Icon></IconStyle><LabelStyle>		<scale>1.0</scale></LabelStyle></Style>';
    const folder = `<Style id="singleLine">
        <ListStyle>
          <listItemType>checkHideChildren</listItemType>
          <bgColor>00ff00ff</bgColor>
          <maxSnippetLines>1</maxSnippetLines>
          <ItemIcon>
            <href>${document.location.href}assets/icon.png</href>
          </ItemIcon>
        </ListStyle>
      </Style>`
    return folder + noIcon + tags.map(tag => this.createStyle(tag.color)).join('');
  }

  private colorName2aabbggrr(colorHexHash: string): string {
    const rgb = colorHexHash.replace('#', '');
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

  private createSymbol(name: string, description: string, color: string, geometry: string, row: any[]): string {
    const planarOrientation = this.csvRecords.getPlanarOrientation(row);
    const linearOrientation = this.csvRecords.getLinearOrientation(row);
    const noIcon = (!planarOrientation && !linearOrientation) ? 'dot_' : '';

    const content = `<Placemark>
      <name>${name}</name>
      <description><![CDATA[${description}]]></description>
      <styleUrl>#_${noIcon}${color}</styleUrl>
      ${geometry}
      </Placemark>${this.labels.join()}`;

    if (this.options.groupGeometry) {
      return this.createFolder(name, '0', content, description, 'singleLine');
    } else {
      return content;
    }
  }

  private createLabel(coordinates: string, dip: number | undefined): string {
    return dip ? `<Placemark>
      <name>${dip}</name>
      <styleUrl>#sn_no_icon</styleUrl>
      <Point>
        <altitudeMode>${this.rowAltitudeMod}</altitudeMode>
        <coordinates>${coordinates}</coordinates>
      </Point>
    </Placemark>`: '';
  }

  private createFolder(folderName: string, open = '0', content: string, description: string = '', style: string = ''): string {
    return `<Folder>
      <name>${folderName}</name>
      <styleUrl>#${style}</styleUrl>
      <description><![CDATA[${description}]]></description>
      <open>${open}</open>
      ${content}
    </Folder>`
  }

  private getAltitudeMod(latLngAlt: LatLngAlt): AltitudeMode {
    return this.options.useAltitude ? (latLngAlt.alt ? 'absolute' : 'relativeToGround') : 'relativeToGround';
  }

  private getAltitude(latLngAlt: LatLngAlt): number {
    return this.options.symbolHeight + (this.options.useAltitude && latLngAlt.alt ? latLngAlt.alt : 0);
  }

  private generateStrikeDipGeometry(latLngAlt: LatLngAlt, orientation: Orientation): string[] {
    const unit = this.options.symbolLength / 2;
    const pm = new google.maps.LatLng(latLngAlt.lat, latLngAlt.lng);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike + 180);
    const p3 = google.maps.geometry.spherical.computeOffset(pm, unit / 2 * Math.cos(orientation.dip * Math.PI / 180), orientation.strike + 90);

    const altitude = this.getAltitude(latLngAlt);

    const alt = altitude - unit / 2 * Math.sin(orientation.dip * Math.PI / 180);
    const coordinates = `${p3.lng()},${p3.lat()},${alt}`;
    this.labels.push(this.createLabel(coordinates, orientation.dip));

    return [
      this.createLinearString([
        [p1.lng(), p1.lat(), altitude],
        [pm.lng(), pm.lat(), altitude],
        [p3.lng(), p3.lat(), alt],
        [pm.lng(), pm.lat(), altitude],
        [p2.lng(), p2.lat(), altitude]
      ], this.rowAltitudeMod)
    ];
  }

  // Crossed circle with only a strike, same height
  private generateStrikeDip0Geometry(latLngAlt: LatLngAlt, orientation: Orientation): string[] {
    const unit = this.options.symbolLength / 2;
    const pm = new google.maps.LatLng(latLngAlt.lat, latLngAlt.lng);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike + 90);
    const p3 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike + 180);
    const p4 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike + 270);

    let circles = [];
    for (let step = 0; step <= 360; step += 10) {
      circles.push(google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike + step));
    }

    const altitude = this.getAltitude(latLngAlt);

    circles = circles.map(c => [c.lng(), c.lat(), altitude]);

    return [
      this.createLinearString([
        [p1.lng(), p1.lat(), altitude],
        [p3.lng(), p3.lat(), altitude]
      ], this.rowAltitudeMod),
      this.createLinearString([
        [p2.lng(), p2.lat(), altitude],
        [p4.lng(), p4.lat(), altitude]
      ], this.rowAltitudeMod),
      this.createLinearString(circles, this.rowAltitudeMod)
    ];
  }

  private generateStrikeDip90Geometry(latLngAlt: LatLngAlt, orientation: Orientation): string[] {
    const unit = this.options.symbolLength / 2;
    const pm = new google.maps.LatLng(latLngAlt.lat, latLngAlt.lng);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike + 180);

    const p1a = google.maps.geometry.spherical.computeOffset(pm, unit / 2, orientation.strike + 90);
    const p2a = google.maps.geometry.spherical.computeOffset(pm, unit / 2, orientation.strike + 270);
    const altitude = this.getAltitude(latLngAlt);

    return [
      this.createLinearString([
        [p1.lng(), p1.lat(), altitude],
        [p2.lng(), p2.lat(), altitude]
      ], this.rowAltitudeMod),
      this.createLinearString([
        [p1a.lng(), p1a.lat(), altitude],
        [p2a.lng(), p2a.lat(), altitude]
      ], this.rowAltitudeMod),
      this.createLinearString([
        [pm.lng(), pm.lat(), altitude],
        [pm.lng(), pm.lat(), altitude - unit / 2]
      ], this.rowAltitudeMod)
    ];
  }

  // Line
  private generateFoliationGeometry(latLngAlt: LatLngAlt, orientation: Orientation): string {
    const unit = this.options.symbolLength / 2;
    const pm = new google.maps.LatLng(latLngAlt.lat, latLngAlt.lng);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike);
    const p1a = google.maps.geometry.spherical.computeOffset(pm, unit / 2, orientation.strike);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, unit, orientation.strike + 180);
    const p2a = google.maps.geometry.spherical.computeOffset(pm, unit / 2, orientation.strike + 180);
    const p3 = google.maps.geometry.spherical.computeOffset(pm, unit / 2 * Math.cos(orientation.dip * Math.PI / 180), orientation.strike + 90);

    const altitude = this.getAltitude(latLngAlt);


    const alt = altitude - unit / 2 * Math.sin(orientation.dip * Math.PI / 180);
    const coordinates = `${p3.lng()},${p3.lat()},${alt}`;
    this.labels.push(this.createLabel(coordinates, orientation.dip));

    return this.createLinearString([
      [p1.lng(), p1.lat(), altitude],
      [p1a.lng(), p1a.lat(), altitude],
      [p3.lng(), p3.lat(), alt],
      [p2a.lng(), p2a.lat(), altitude],
      [p1a.lng(), p1a.lat(), altitude],
      [p2a.lng(), p2a.lat(), altitude],
      [p2.lng(), p2.lat(), altitude]
    ], this.rowAltitudeMod);
  }

  // Line with the arrow at one end
  private generateLineationGeometry(latLngAlt: LatLngAlt, orientation: Orientation): string[] {
    const unit = this.options.symbolLength / 4;
    const pm = new google.maps.LatLng(latLngAlt.lat, latLngAlt.lng);
    const f = Math.cos(orientation.dip * Math.PI / 180);
    const p1 = google.maps.geometry.spherical.computeOffset(pm, f * unit, orientation.strike + 0);
    const p2 = google.maps.geometry.spherical.computeOffset(pm, f * unit, orientation.strike + 180);
    const pArr = google.maps.geometry.spherical.computeOffset(pm, f * unit * 0.7, orientation.strike + 0);
    const p2a = google.maps.geometry.spherical.computeOffset(pArr, f * unit * 0.1, orientation.strike - 90);
    const p2b = google.maps.geometry.spherical.computeOffset(pArr, f * unit * 0.1, orientation.strike + 90);
    const altitude = this.getAltitude(latLngAlt);

    const alt = Math.sin(orientation.dip * Math.PI / 180);
    const coordinates = `${p1.lng()},${p1.lat()},${altitude - unit * alt}`;
    this.labels.push(this.createLabel(coordinates, orientation.dip));
    return [
      this.createLinearString([
        [p1.lng(), p1.lat(), altitude - unit * alt],
        [p2.lng(), p2.lat(), altitude + unit * alt]
      ], this.rowAltitudeMod),
      this.createLinearString([
        [p2a.lng(), p2a.lat(), altitude - unit * 0.7 * alt],
        [p1.lng(), p1.lat(), altitude - unit * alt],
        [p2b.lng(), p2b.lat(), altitude - unit * 0.7 * alt]
      ], this.rowAltitudeMod)
    ];
  }

  private createLinearString(coords: any[], altitudeMode: AltitudeMode = 'relativeToGround'): string {
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
