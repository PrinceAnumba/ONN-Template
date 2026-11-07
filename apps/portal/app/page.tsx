import { country } from "@onn/config";

export default function Page() {
  return (
    <main className="onn-container">
      <h1>{country.observatory.longName[country.locales.default]}</h1>
    </main>
  );
}
