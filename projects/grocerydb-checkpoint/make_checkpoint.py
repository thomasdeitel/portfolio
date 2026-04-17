from __future__ import annotations

import argparse
import textwrap
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.ticker import FuncFormatter, PercentFormatter


PROJECT_DIR = Path(__file__).resolve().parent
LOCAL_DATA_DEFAULT = PROJECT_DIR / "data" / "grocerydb.csv"
DOWNLOADS_DATA_FALLBACK = Path.home() / "Downloads" / "grocerydb.csv"
DATA_DEFAULT = LOCAL_DATA_DEFAULT if LOCAL_DATA_DEFAULT.exists() else DOWNLOADS_DATA_FALLBACK
OUTDIR_DEFAULT = Path(__file__).resolve().parent / "output"

STORE_ORDER = ["WholeFoods", "Walmart", "Target"]
STORE_LABELS = {
    "WholeFoods": "Whole Foods",
    "Walmart": "Walmart",
    "Target": "Target",
}

NOVA_LABELS = {
    0: "0 Minimal",
    1: "1 Ingredients",
    2: "2 Processed",
    3: "3 Ultra-processed",
}

NOVA_COLORS = {
    0: "#6b8e23",
    1: "#b6bf59",
    2: "#e5b55d",
    3: "#bf3b2c",
}

STORE_COLORS = {
    "WholeFoods": "#2b6f5d",
    "Walmart": "#d58f00",
    "Target": "#c53a2f",
}

HEATMAP_CMAP = LinearSegmentedColormap.from_list(
    "processing",
    ["#e6f3ea", "#c9dfc7", "#f4d06f", "#e98b43", "#ba3b2a"],
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DATA_DEFAULT)
    parser.add_argument("--outdir", type=Path, default=OUTDIR_DEFAULT)
    return parser.parse_args()


def pretty_category(raw: str) -> str:
    manual = {
        "produce-beans-wf": "Produce / Beans",
        "produce-packaged": "Packaged Produce",
        "prepared-meals-dishes": "Prepared Meals",
        "pastry-chocolate-candy": "Pastry / Candy",
        "snacks-bars": "Snack Bars",
        "snacks-mixes-crackers": "Crackers / Snack Mixes",
        "snacks-chips": "Chips",
        "snacks-popcorn": "Popcorn",
        "snacks-dips-salsa": "Dips / Salsa",
        "snacks-nuts-seeds": "Snack Nuts / Seeds",
        "dairy-yogurt-drink": "Yogurt Drinks",
        "ice-cream-dessert": "Ice Cream / Dessert",
        "meat-packaged": "Packaged Meat",
        "meat-poultry-wf": "Fresh Meat / Poultry",
        "milk-milk-substitute": "Milk / Alternatives",
        "drink-shakes-other": "Shakes / Other Drinks",
        "drink-soft-energy-mixes": "Soft / Energy Drinks",
        "drink-juice": "Juice",
        "drink-coffee": "Coffee",
        "rolls-buns-wraps": "Rolls / Buns / Wraps",
        "cookies-biscuit": "Cookies / Biscuits",
        "soup-stew": "Soup / Stew",
        "sauce-all": "Sauces",
        "seafood-wf": "Fresh Seafood",
        "eggs-wf": "Eggs",
        "nuts-seeds-wf": "Nuts / Seeds",
        "rice-grains-wf": "Rice / Grains",
    }
    if raw in manual:
        return manual[raw]
    return raw.replace("-", " ").title()


def style_axes(ax: plt.Axes) -> None:
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#b0b0b0")
    ax.spines["bottom"].set_color("#b0b0b0")
    ax.tick_params(colors="#333333")


def plot_candidate_1(df: pd.DataFrame) -> plt.Figure:
    shares = (
        df.groupby(["store", "FPro_class"]).size().unstack(fill_value=0).reindex(index=STORE_ORDER, columns=[0, 1, 2, 3])
    )
    shares = shares.div(shares.sum(axis=1), axis=0)
    counts = df.groupby("store").size().reindex(STORE_ORDER)

    fig, ax = plt.subplots(figsize=(11, 6.5))
    y = np.arange(len(STORE_ORDER))
    left = np.zeros(len(STORE_ORDER))

    for nova_class in [0, 1, 2, 3]:
        widths = shares[nova_class].to_numpy()
        bars = ax.barh(
            y,
            widths,
            left=left,
            height=0.62,
            color=NOVA_COLORS[nova_class],
            edgecolor="white",
            linewidth=1.0,
            label=NOVA_LABELS[nova_class],
        )
        for bar, width in zip(bars, widths):
            if width >= 0.08:
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    bar.get_y() + bar.get_height() / 2,
                    f"{width:.0%}",
                    ha="center",
                    va="center",
                    fontsize=10,
                    color="white" if nova_class == 3 else "#222222",
                    fontweight="bold",
                )
        left += widths

    ultra = shares[3].to_dict()
    for idx, store in enumerate(STORE_ORDER):
        ax.text(
            1.01,
            idx,
            f"{ultra[store]:.0%} ultra-processed\nn = {counts[store]:,}",
            transform=ax.get_yaxis_transform(),
            va="center",
            ha="left",
            fontsize=10,
            color="#333333",
        )

    ax.set_xlim(0, 1)
    ax.set_yticks(y)
    ax.set_yticklabels([STORE_LABELS[s] for s in STORE_ORDER], fontsize=11)
    ax.invert_yaxis()
    ax.xaxis.set_major_formatter(PercentFormatter(1))
    ax.grid(axis="x", color="#dddddd", linewidth=0.8)
    style_axes(ax)
    ax.set_xlabel("Share of products in each NOVA processing class", fontsize=11)
    ax.set_title(
        "Candidate 1. Whole Foods carries fewer ultra-processed foods,\n"
        "but they still dominate every store.",
        loc="left",
        fontsize=15,
        fontweight="bold",
        pad=20,
    )
    ax.text(
        0,
        1.01,
        "100% stacked bars across all 26,250 products. Colors move from minimally processed to ultra-processed.",
        transform=ax.transAxes,
        fontsize=10,
        color="#555555",
    )
    ax.legend(
        ncol=4,
        frameon=False,
        bbox_to_anchor=(0, -0.16, 1, 0.1),
        loc="upper left",
        fontsize=10,
        handlelength=1.4,
    )
    fig.subplots_adjust(top=0.84, bottom=0.18)
    return fig


def plot_candidate_2(df: pd.DataFrame) -> plt.Figure:
    counts = df.groupby(["category", "store"]).size().unstack(fill_value=0)
    keep = counts[counts[STORE_ORDER].min(axis=1) >= 40].copy()
    keep["total"] = keep[STORE_ORDER].sum(axis=1)
    selected = keep.sort_values("total", ascending=False).head(15).index

    ultra = (
        df.assign(is_ultra=df["FPro_class"] == 3)
        .groupby(["category", "store"])["is_ultra"]
        .mean()
        .unstack()
        .reindex(index=selected, columns=STORE_ORDER)
    )
    ultra["avg"] = ultra.mean(axis=1)
    ultra = ultra.sort_values("avg")

    matrix = ultra[STORE_ORDER]
    label_rows = []
    total_counts = counts.loc[matrix.index, STORE_ORDER].sum(axis=1)
    for category, total in zip(matrix.index, total_counts):
        label_rows.append(f"{pretty_category(category)}  (n={int(total):,})")

    fig, ax = plt.subplots(figsize=(10.5, 8.8))
    img = ax.imshow(matrix.to_numpy(), cmap=HEATMAP_CMAP, vmin=0, vmax=1, aspect="auto")

    ax.set_xticks(range(len(STORE_ORDER)))
    ax.set_xticklabels([STORE_LABELS[s] for s in STORE_ORDER], fontsize=11)
    ax.set_yticks(range(len(matrix.index)))
    ax.set_yticklabels(label_rows, fontsize=10)

    for row in range(matrix.shape[0]):
        for col in range(matrix.shape[1]):
            value = matrix.iloc[row, col]
            ax.text(
                col,
                row,
                f"{value:.0%}",
                ha="center",
                va="center",
                fontsize=10,
                color="white" if value >= 0.62 else "#1f1f1f",
                fontweight="bold",
            )

    ax.tick_params(top=True, bottom=False, labeltop=True, labelbottom=False, pad=2)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_xticks(np.arange(-0.5, len(STORE_ORDER), 1), minor=True)
    ax.set_yticks(np.arange(-0.5, len(matrix.index), 1), minor=True)
    ax.grid(which="minor", color="white", linestyle="-", linewidth=1.4)
    ax.tick_params(which="minor", bottom=False, left=False)

    cbar = fig.colorbar(img, ax=ax, fraction=0.035, pad=0.025)
    cbar.ax.yaxis.set_major_formatter(PercentFormatter(1))
    cbar.outline.set_visible(False)
    cbar.ax.set_ylabel("Ultra-processed share", rotation=90, labelpad=12)

    fig.suptitle(
        "Candidate 2. The biggest store differences appear in fresh staples;\n"
        "snack aisles are processed everywhere.",
        x=0.23,
        y=0.975,
        ha="left",
        fontsize=15,
        fontweight="bold",
    )
    fig.text(
        0.23,
        0.91,
        "Categories shown only if each store has at least 40 items. Cells report the share classified as ultra-processed.",
        ha="left",
        fontsize=9.5,
        color="#555555",
    )

    fig.subplots_adjust(top=0.86, left=0.23, right=0.93, bottom=0.06)
    return fig


def plot_candidate_3(df: pd.DataFrame) -> plt.Figure:
    trimmed = df.dropna(subset=["price percal"]).copy()
    low, high = trimmed["price percal"].quantile([0.01, 0.99])
    trimmed = trimmed[(trimmed["price percal"] >= low) & (trimmed["price percal"] <= high)]

    grouped = (
        trimmed.groupby(["store", "category"])
        .agg(
            items=("name", "size"),
            median_fpro=("FPro", "median"),
            median_ppc=("price percal", "median"),
        )
        .reset_index()
    )
    grouped = grouped[grouped["items"] >= 25].copy()
    grouped["price_per_100_cal"] = grouped["median_ppc"] * 100

    fig, ax = plt.subplots(figsize=(11, 7))

    for store in STORE_ORDER:
        sub = grouped[grouped["store"] == store].copy()
        sizes = np.interp(sub["items"], (sub["items"].min(), sub["items"].max()), (45, 220))
        ax.scatter(
            sub["median_fpro"],
            sub["price_per_100_cal"],
            s=sizes,
            alpha=0.78,
            color=STORE_COLORS[store],
            edgecolor="white",
            linewidth=0.8,
            label=STORE_LABELS[store],
        )

        if len(sub) >= 2:
            x = sub["median_fpro"].to_numpy()
            y = np.log10(sub["price_per_100_cal"].to_numpy())
            slope, intercept = np.polyfit(x, y, 1)
            xs = np.linspace(x.min(), x.max(), 100)
            ys = 10 ** (slope * xs + intercept)
            ax.plot(xs, ys, color=STORE_COLORS[store], linewidth=2.2, alpha=0.95)

    annotations = [
        ("WholeFoods", "produce-beans-wf", (7, 8)),
        ("WholeFoods", "seafood-wf", (8, 0)),
        ("Target", "cookies-biscuit", (8, -10)),
        ("Walmart", "pastry-chocolate-candy", (8, -10)),
        ("Target", "cereal", (8, 6)),
    ]
    for store, category, offset in annotations:
        match = grouped[(grouped["store"] == store) & (grouped["category"] == category)]
        if match.empty:
            continue
        row = match.iloc[0]
        ax.annotate(
            pretty_category(category),
            (row["median_fpro"], row["price_per_100_cal"]),
            xytext=offset,
            textcoords="offset points",
            fontsize=9,
            color="#303030",
            bbox={"boxstyle": "round,pad=0.2", "fc": "white", "ec": "none", "alpha": 0.9},
        )

    ax.set_yscale("log")
    ax.yaxis.set_major_formatter(FuncFormatter(lambda y, _: f"${y:.2f}"))
    ax.set_xlim(0, 1.02)
    ax.grid(color="#dddddd", linewidth=0.8)
    style_axes(ax)
    ax.set_xlabel("Median Food Processing Score (0 = minimal, 1 = highly processed)", fontsize=11)
    ax.set_ylabel("Median price per 100 calories (log scale)", fontsize=11)
    ax.set_title(
        "Candidate 3. The cheapest calories usually come from\n"
        "the most processed categories.",
        loc="left",
        fontsize=15,
        fontweight="bold",
        pad=20,
    )
    ax.text(
        0,
        1.01,
        "Each point is a store-category median with at least 25 products. Row-level price-per-calorie outliers were trimmed at the 1st and 99th percentiles.",
        transform=ax.transAxes,
        fontsize=10,
        color="#555555",
    )
    ax.legend(frameon=False, ncol=3, loc="upper right")
    fig.subplots_adjust(top=0.86, bottom=0.12)
    return fig


def plot_preference_page() -> plt.Figure:
    paragraph = (
        "I would choose Candidate 2 for the final project. The heatmap keeps the comparison between "
        "stores simple, but it also shows that the gap is not the same in every part of the store. "
        "The biggest differences show up in fresher categories like beans, eggs, and seafood, while "
        "snack categories such as cookies, chips, and crackers are heavily processed no matter where "
        "they are sold. I think that makes the main point easier to understand than Candidate 1, which "
        "only gives the overall store totals. Candidate 3 is interesting too, but the price-per-calorie "
        "story feels easier to over-interpret. For the final version, I would keep Candidate 2 and add "
        "a few annotations to point readers to the categories with the biggest gaps and the categories "
        "where all three stores look basically the same."
    )

    fig = plt.figure(figsize=(11, 8.5))
    ax = fig.add_axes([0.08, 0.08, 0.84, 0.84])
    ax.axis("off")
    ax.text(
        0,
        0.96,
        "Preferred Direction",
        fontsize=18,
        fontweight="bold",
        va="top",
    )
    ax.text(
        0,
        0.86,
        textwrap.fill(paragraph, width=95),
        fontsize=13,
        va="top",
        linespacing=1.5,
    )
    return fig


def save_outputs(figures: list[tuple[str, plt.Figure]], outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    pdf_path = outdir / "grocerydb_checkpoint.pdf"

    with PdfPages(pdf_path) as pdf:
        for stem, fig in figures:
            fig.savefig(outdir / f"{stem}.png", dpi=220, bbox_inches="tight")
            pdf.savefig(fig, bbox_inches="tight")

    for _, fig in figures:
        plt.close(fig)


def main() -> None:
    args = parse_args()
    if not args.data.exists():
        raise FileNotFoundError(f"Could not find dataset at {args.data}")

    plt.style.use("seaborn-v0_8-whitegrid")

    df = pd.read_csv(args.data)
    figures = [
        ("candidate_1_store_nova_shares", plot_candidate_1(df)),
        ("candidate_2_category_heatmap", plot_candidate_2(df)),
        ("candidate_3_price_vs_processing", plot_candidate_3(df)),
        ("preferred_direction", plot_preference_page()),
    ]
    save_outputs(figures, args.outdir)
    print(f"Wrote checkpoint assets to {args.outdir}")


if __name__ == "__main__":
    main()
