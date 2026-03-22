import { Directive, ElementRef, EventEmitter, Input, AfterViewInit, Output, inject } from '@angular/core';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';

export interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

declare const google: any;

@Directive({
  selector: '[appPlacesAutocomplete]',
  standalone: true,
})
export class PlacesAutocompleteDirective implements AfterViewInit {
  @Input() country = 'pe';
  @Output() placeSelected = new EventEmitter<PlaceResult>();

  private el = inject(ElementRef);
  private mapsLoader = inject(GoogleMapsLoaderService);

  ngAfterViewInit() {
    this.mapsLoader.load().then(() => this.initAutocomplete());
  }

  private initAutocomplete() {
    // Session token: agrupa todos los keystrokes + la selección final en
    // 1 sola unidad facturable (~$0.017) en lugar de cobrar por keystroke.
    let sessionToken = new google.maps.places.AutocompleteSessionToken();

    const autocomplete = new google.maps.places.Autocomplete(
      this.el.nativeElement,
      {
        types: ['geocode', 'establishment'],
        componentRestrictions: { country: this.country },
        // Solo pedimos los campos mínimos necesarios → tier más económico
        fields: ['formatted_address', 'geometry'],
        sessionToken,
      }
    );

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place?.geometry?.location) {
        this.placeSelected.emit({
          address: place.formatted_address || this.el.nativeElement.value,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
      // Renovar sesión después de cada selección
      sessionToken = new google.maps.places.AutocompleteSessionToken();
    });
  }
}
