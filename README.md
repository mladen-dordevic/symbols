# Symbols

[Symbols](http://csmgeo.csm.jmu.edu/Geollab/Whitmeyer/geode/symbols/) inputs a CSV file of structural data from field stations and outputs a Google Earth KML file with inclined orientation symbols. 3D symbols are positioned above the Google Earth landscape based on the parameters below. It is suggested that your CSV file has columns for each of the parameters below, but the only columns that are required are Latitude, Longitude, and Unit/Formation. Sample CSV file can be found in src/app/assets/test-data.csv

## How to build and deploy
Clone this
```
git clone git@github.com:mladen-dordevic/symbols.git
```
Enter into projects directory
```
cd symbols
```
Install dependencies
```
npm install
```
Assign Google Maps API key value to `googleMapsKey` variable in `src/environments/environment.prod.ts`. For example: if you key is `xxxxx`, line in the `environment.prod.ts` file would look like:

`googleMapsKey: 'xxxxx'`

Now you are ready to build. To serve the app from /
```
ng build --configuration production
```

To serve the app from /some/path you need to build and pass the `base-href` parameter
```
ng build --configuration production --base-href /some/path/
```
Deploy `dist/symbols` to your server
