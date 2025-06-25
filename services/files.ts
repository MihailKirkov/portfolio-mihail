
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadFile(file: File, pathPrefix = "projects"): Promise<string> {
    const storage = getStorage();
    const fileRef = ref(storage, `${pathPrefix}/${Date.now()}-${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
}
