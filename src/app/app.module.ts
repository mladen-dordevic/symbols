import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MapComponent } from './components/map/map.component';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AngularMaterialModule } from './angular-material.module';
import { ColorPickerModule } from 'ngx-color-picker';
import { environment } from '@env/environment';


@NgModule({
  declarations: [
    AppComponent,
    MapComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    AngularMaterialModule,
    ColorPickerModule,
    BrowserAnimationsModule,
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: () => loadGoogleMaps,
      deps: [],
      multi: true
    },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }


export function loadGoogleMaps(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const node = document.createElement('script');
    const key = environment.googleMapsKey ? `&key=${environment.googleMapsKey}` : '';
    node.src = `https://maps.google.com/maps/api/js?libraries=geometry,drawing${key}`;
    node.type = 'text/javascript';
    node.async = false;
    document.getElementsByTagName('head')[0].appendChild(node);
    node.onload = () => {
      resolve(true);
    }
    node.onerror = (error) => {
      console.log(error);
      reject(error)
    }
  });
}
