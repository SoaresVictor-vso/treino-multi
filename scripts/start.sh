#!/bin/bash

gnome-terminal -- bash -c "
cd '$PWD';
npm run dev;
exec bash
"

gnome-terminal -- bash -c "
cd '$PWD/back-end';
npm run start:dev;
exec bash
"

gnome-terminal -- bash -c "
cd '$PWD/front-end';
npm run dev;
exec bash
"
