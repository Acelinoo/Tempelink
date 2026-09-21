// @ts-check
import { module } from "@prisma/composer";
import tempelinkService from "./service.mjs";

export default module("tempelink", ({ provision }) => {
  provision(tempelinkService);
});
