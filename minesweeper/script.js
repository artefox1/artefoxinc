const WIDTH = 10;
const HEIGHT = 10;
const MINES = 15;

let gameOver = false;
let firstClick = true;

let hitX = -1;
let hitY = -1;

const board = [];
const boardDiv = document.getElementById("board");

// 9 = closed
// 10 = flagged correct (bomb)
// 11 = flagged wrong (empty)
// 12 = bomb
// 0-8 = opened number
// 13 = queued for floodfill

// init board
for (let y = 0; y < HEIGHT; y++) {
    board[y] = [];
    for (let x = 0; x < WIDTH; x++) {
        board[y][x] = 9;
    }
}

// generate board (safe first click)
function generateBoard(safeX = -1, safeY = -1) {

    while (true) {

        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                board[y][x] = 9;
            }
        }

        let placed = 0;

        while (placed < MINES) {

            const x = Math.floor(Math.random() * WIDTH);
            const y = Math.floor(Math.random() * HEIGHT);

            if (board[y][x] !== 12) {
                board[y][x] = 12;
                placed++;
            }
        }

        if (safeX === -1) return;

        if (board[safeY][safeX] !== 12 &&
            countMines(safeX, safeY) === 0) {
            return;
        }
    }
}


function countMines(x, y) {

    let count = 0;

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {

            const nx = x + dx;
            const ny = y + dy;

            if (
                nx >= 0 && ny >= 0 &&
                nx < WIDTH && ny < HEIGHT &&
                (board[ny][nx] === 12 || board[ny][nx] === 10)
            ) {
                count++;
            }
        }
    }

    return count;
}


function handleClick(x, y) {

    if (gameOver) return;

    // cannot open flags
    if (board[y][x] === 10 || board[y][x] === 11)
        return;


    if (firstClick) {

        generateBoard(x, y);
        firstClick = false;
    }


    if (board[y][x] === 12) {

        gameOver = true;
        hitX = x;
        hitY = y;

        render();
        return;
    }


    reveal(x, y);
}


// FIFO floodfill
function reveal(startX, startY) {

    const queue = [];

    let maxQueueSize = 0;

    // add starting cell
    queue.push({
        x: startX,
        y: startY
    });

    console.log(queue.length)
    maxQueueSize = Math.max(maxQueueSize, queue.length);

    while (queue.length > 0) {

        const cell = queue.shift();
        console.log(queue.length)

        const x = cell.x;
        const y = cell.y;


        // open cell
        const mines = countMines(x, y);

        board[y][x] = mines;


        // expand zeroes
        if (mines === 0) {

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {

                    const nx = x + dx;
                    const ny = y + dy;


                    if (
                        nx >= 0 && ny >= 0 &&
                        nx < WIDTH && ny < HEIGHT &&
                        board[ny][nx] === 9
                    ) {


                        queue.push({
                            x: nx,
                            y: ny
                        });

                        console.log(queue.length)
                        maxQueueSize = Math.max(maxQueueSize, queue.length);
                    }
                }
            }
        }
    }
    console.log("Max size:", maxQueueSize);

    render();
}


function render() {

    boardDiv.innerHTML = "";

    for (let y = 0; y < HEIGHT; y++) {

        for (let x = 0; x < WIDTH; x++) {

            const img = document.createElement("img");

            img.draggable = false;

            const tile = board[y][x];


            if (gameOver) {

                if (x === hitX && y === hitY && tile === 12) {
                    img.src = "images/hit.png";
                }

                else if (tile === 10) {
                    img.src = "images/flag.png";
                }

                else if (tile === 11) {
                    img.src = "images/wrong.png";
                }

                else if (tile === 12) {
                    img.src = "images/mine.png";
                }

                else {
                    img.src = tile === 9
                        ? "images/closed.png"
                        : `images/${tile}.png`;
                }

            }

            else {

                if (tile === 12)
                    img.src = "images/closed.png";

                else if (tile === 9)
                    img.src = "images/closed.png";

                else if (tile === 10 || tile === 11)
                    img.src = "images/flag.png";

                else
                    img.src = `images/${tile}.png`;
            }


            img.className = "tile";


            img.addEventListener("click", () => {
                handleClick(x, y);
            });


            img.addEventListener("contextmenu", (e) => {

                e.preventDefault();

                if (gameOver) return;


                const t = board[y][x];


                if (t === 9)
                    board[y][x] = 11;

                else if (t === 11)
                    board[y][x] = 9;

                else if (t === 12)
                    board[y][x] = 10;

                else if (t === 10)
                    board[y][x] = 12;


                render();
            });


            boardDiv.appendChild(img);
        }
    }
}


render();


document.getElementById("restartBtn")
    .addEventListener("click", () => location.reload());
