=== Seed demo dát do MongoDB (USB) ===

1. Spusti MongoDB: dvojklik na start-db.bat (v koreni USB) a nechaj okno otvorené.
2. V priečinku app spusti:
   npm run seed:usb
   (alebo: node scripts/seed-usb.js)

3. Skript vymaže existujúce dáta v collections a vytvorí demo účet a dáta.

Demo účty (heslo pre všetky: password123):
  - admin@demo.sk       (admin)
  - trainer1@demo.sk, trainer2@demo.sk (tréneri)
  - student1@demo.sk … student4@demo.sk (študenti)

V databáze bude: 1 klub (DEMO), 2 páry, 2 skupiny, 1 rozvrh s 2 lekciami.
