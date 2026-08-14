import allahMuhammadImage from "../../../assets/products/allah-muhammad.jpg";
import asmaulAllahImage from "../../../assets/products/asmauAllah.jpg";
import birdFeederImage from "../../../assets/products/birdfeeder.jpg";
import fanous1Image from "../../../assets/products/fanous1.jpg";
import fanous2Image from "../../../assets/products/fanous2.jpg";
import loveImage from "../../../assets/products/love.jpg";
import muhammadImage from "../../../assets/products/muhammad.jpg";
import pageStopImage from "../../../assets/products/pageStop.jpg";

import type { Product } from "../../../types/product";

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Allah & Muhammad Dekoration",
    description:
      "3D-printad islamisk dekoration med Allah och Muhammad, skapad som en stilren detalj för hemmet.",
    price: 249,
    imageUrl: allahMuhammadImage,
    stock: 6,
    category: "Islamisk dekoration",
  },
  {
    id: "2",
    name: "Asma ul Husna",
    description:
      "Dekorativ 3D-print med Allahs vackra namn. En elegant och personlig detalj för hemmet.",
    price: 299,
    imageUrl: asmaulAllahImage,
    stock: 4,
    category: "Islamisk dekoration",
  },
  {
    id: "3",
    name: "Fanoos LED-lykta",
    description:
      "3D-printad Fanoos-lykta med detaljrikt mönster. Anpassad för säker LED-belysning.",
    price: 219,
    imageUrl: fanous1Image,
    stock: 10,
    category: "Belysning",
  },
  {
    id: "4",
    name: "Fanoos Premium",
    description:
      "En större dekorativ Fanoos med traditionellt inspirerad design och modern 3D-printad finish.",
    price: 279,
    imageUrl: fanous2Image,
    stock: 7,
    category: "Belysning",
  },
  {
    id: "5",
    name: "Muhammad ﷺ Dekoration",
    description:
      "Stilren 3D-printad kalligrafidekoration med namnet Muhammad ﷺ för hylla, skrivbord eller hem.",
    price: 189,
    imageUrl: muhammadImage,
    stock: 8,
    category: "Islamisk dekoration",
  },
  {
    id: "6",
    name: "Love Dekoration",
    description:
      "Modern 3D-printad dekoration som passar perfekt på skrivbord, hylla eller som personlig present.",
    price: 149,
    imageUrl: loveImage,
    stock: 12,
    category: "Dekoration",
  },
  {
    id: "7",
    name: "Sidhållare",
    description:
      "Praktisk 3D-printad sidhållare som hjälper till att hålla boken öppen när du läser.",
    price: 79,
    imageUrl: pageStopImage,
    stock: 20,
    category: "Tillbehör",
  },
  {
    id: "8",
    name: "Fågelmatare",
    description:
      "3D-printad fågelmatare för trädgård eller balkong. Enkel att fylla och montera.",
    price: 169,
    imageUrl: birdFeederImage,
    stock: 9,
    category: "Hem & trädgård",
  },
];
