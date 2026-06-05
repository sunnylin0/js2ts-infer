function getBarYAt(startx: number, starty: number, endx: number, endy: number, x: number): number {
	return starty + (endy - starty) / (endx - startx) * (x - startx);
}

export default getBarYAt;
