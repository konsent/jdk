import { db } from "./firebase-init.js";
import { normalizeMembers } from "./party-logic.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function listMyParties(ownerUid) {
  const snap = await getDocs(query(collection(db, "parties"), where("ownerUid", "==", ownerUid)));
  return snap.docs.map((d) => ({ id: d.id, name: d.data().name, memberUids: d.data().memberUids || [] }));
}

export async function createParty(ownerUid, name, memberUids) {
  const ref = await addDoc(collection(db, "parties"), {
    ownerUid,
    name,
    memberUids: normalizeMembers(ownerUid, memberUids),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateParty(partyId, ownerUid, name, memberUids) {
  await updateDoc(doc(db, "parties", partyId), {
    name,
    memberUids: normalizeMembers(ownerUid, memberUids),
    updatedAt: serverTimestamp()
  });
}

export async function deleteParty(partyId) {
  await deleteDoc(doc(db, "parties", partyId));
}

export async function listApprovedUsers() {
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
  return snap.docs.map((d) => ({ uid: d.id, nickname: d.data().nickname || d.id }));
}
