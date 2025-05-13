import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Storage, ref, uploadBytesResumable, getDownloadURL, StorageReference } from '@angular/fire/storage';

@Injectable({
  providedIn: 'root'
})
export class UploadService {

  baseUrl = environment.api
  private readonly storage: Storage = inject(Storage);

  constructor(private http: HttpClient) { }

  upload(file: File, resourceType: string = 'image'): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('resourceType', resourceType);
    return this.http.post<any>(`${this.baseUrl}/upload`, formData);
  }

  uploadFile(file: File, path: string): { uploadProgress$: Observable<number>, downloadUrl$: Observable<string> } {
    const filePath = `${path}/${file.name}_${Date.now()}`;
    const storageRef: StorageReference = ref(this.storage, filePath);
    const uploadTask: any = uploadBytesResumable(storageRef, file);
    const uploadProgress$ = new Observable<number>(observer => {
      uploadTask.on('state_changed',
        (snapshot: any) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          observer.next(progress);
        },
        (error: any) => {
          console.error('Error durante la subida:', error);
          observer.error(error);
        },
        () => {
          // No se completa aquí, esperamos a getDownloadURL
          // observer.complete(); // No completar aquí para que downloadUrl$ funcione correctamente
        }
      );
      // Podrías añadir un return () => uploadTask.cancel(); para cancelar si la suscripción se destruye
    });

    const downloadUrl$ = from(uploadTask).pipe(
      switchMap(() => from(getDownloadURL(storageRef)))
    );

    return { uploadProgress$, downloadUrl$ };
  }



}
