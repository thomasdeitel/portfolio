from __future__ import annotations

import argparse
import textwrap
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyBboxPatch
from matplotlib.ticker import PercentFormatter
from matplotlib.transforms import blended_transform_factory


PROJECT_DIR = Path(__file__).resolve().parent
LOCAL_DATA_DEFAULT = PROJECT_DIR / "data" / "grocerydb.csv"
CHECKPOINT_DATA_FALLBACK = PROJECT_DIR.parent / "grocerydb-checkpoint" / "data" / "grocerydb.csv"
DOWNLOADS_DATA_FALLBACK = Path.home() / "Downloads" / "grocerydb.csv"
DATA_DEFAULT = (
    LOCAL_DATA_DEFAULT
    if LOCAL_DATA_DEFAULT.exists()
    else CHECKPOINT_DATA_FALLBACK
    if CHECKPOINT_DATA_FALLBACK.exists()
    else DOWNLOADS_DATA_FALLBACK
)
OUTDIR_DEFAULT = PROJECT_DIR / "output"
WRITEUP_DEFAULT = PROJECT_DIR / "writeup.md"

STORE_ORDER = ["WholeFoods", "Walmart", "Target"]
STORE_LABELS = {
    "WholeFoods": "Whole Foods",
    "Walmart": "Walmart",
    "Target": "Target",
}
STORE_COLORS = {
    "WholeFoods": "#2f6f5e",
    "Walmart": "#d79717",
    "Target": "#c9483c",
}

TITLE = "Store choice matters most in the fresh aisle;\nsnack foods are ultra-processed everywhere."


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DATA_DEFAULT)
    parser.add_argument("--outdir", type=Path, default=OUTDIR_DEFAULT)
    parser.add_argument("--writeup", type=Path, default=WRITEUP_DEFAULT)
    return parser.parse_args()


def pretty_category(raw: str) -> str:
    manual = {
        "produce-beans-wf": "Beans and Produce",
        "produce-packaged": "Packaged Produce",
        "pastry-chocolate-candy": "Pastry, Chocolate, and Candy",
        "prepared-meals-dishes": "Prepared Meals",
        "snacks-bars": "Snack Bars",
        "snacks-mixes-crackers": "Crackers and Snack Mixes",
        "snacks-chips": "Chips",
        "snacks-popcorn": "Popcorn",
        "snacks-dips-salsa": "Dips and Salsa",
        "snacks-nuts-seeds": "Nuts and Seeds Snacks",
        "dairy-yogurt-drink": "Yogurt Drinks",
        "ice-cream-dessert": "Ice Cream and Desserts",
        "meat-packaged": "Packaged Meat",
        "milk-milk-substitute": "Milk and Alternatives",
        "drink-shakes-other": "Shakes and Meal Drinks",
        "drink-soft-energy-mixes": "Soft and Energy Drinks",
        "drink-juice": "Juice",
        "drink-coffee": "Coffee",
        "rolls-buns-wraps": "Rolls, Buns, and Wraps",
        "cookies-biscuit": "Cookies and Biscuits",
        "soup-stew": "Soup and Stew",
        "sauce-all": "Sauces",
        "sausage-bacon": "Sausage and Bacon",
        "mac-cheese": "Mac and Cheese",
    }
    if raw in manual:
        return manual[raw]
    return raw.replace("-", " ").title()


def style_axes(ax: plt.Axes) -> None:
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#b5b5b5")
    ax.spines["bottom"].set_color("#b5b5b5")
    ax.tick_params(colors="#323232")


def read_writeup(writeup_path: Path) -> list[str]:
    text = writeup_path.read_text(encoding="utf-8").strip()
    paragraphs = []
    for block in text.split("\n\n"):
        stripped = block.strip()
        if not stripped or stripped.startswith("#"):
            continue
        paragraphs.append(" ".join(line.strip() for line in stripped.splitlines()))
    if not paragraphs:
        raise ValueError(f"No write-up paragraphs found in {writeup_path}")
    return paragraphs


def prepare_data(df: pd.DataFrame, min_items_per_store: int = 75) -> tuple[pd.Series, pd.DataFrame]:
    overall = (
        df.assign(is_ultra=df["FPro_class"] == 3)
        .groupby("store")["is_ultra"]
        .mean()
        .reindex(STORE_ORDER)
    )

    counts = df.groupby(["category", "store"]).size().unstack(fill_value=0).reindex(columns=STORE_ORDER, fill_value=0)
    keep = counts[counts.min(axis=1) >= min_items_per_store].copy()

    shares = (
        df.assign(is_ultra=df["FPro_class"] == 3)
        .groupby(["category", "store"])["is_ultra"]
        .mean()
        .unstack()
        .reindex(index=keep.index, columns=STORE_ORDER)
    )

    summary = shares.copy()
    summary["avg"] = summary.mean(axis=1)
    summary["spread"] = summary.max(axis=1) - summary.min(axis=1)
    summary["total_items"] = keep.sum(axis=1)
    summary["label"] = [pretty_category(category) for category in summary.index]
    summary = summary.sort_values(["avg", "spread"], ascending=[True, False]).reset_index(names="category")
    return overall, summary


def add_annotation(
    ax: plt.Axes,
    text: str,
    x: float,
    y: float,
    tx: float,
    ty: float,
    ha: str = "left",
) -> None:
    ax.annotate(
        text,
        xy=(x, y),
        xytext=(tx, ty),
        textcoords="data",
        ha=ha,
        va="center",
        fontsize=9.3,
        color="#2d2d2d",
        linespacing=1.3,
        bbox={
            "boxstyle": "round,pad=0.35,rounding_size=0.25",
            "fc": "white",
            "ec": "#d8d8d8",
            "lw": 0.9,
            "alpha": 0.98,
        },
        arrowprops={
            "arrowstyle": "-|>",
            "color": "#7a7a7a",
            "lw": 1.1,
            "shrinkA": 6,
            "shrinkB": 4,
            "connectionstyle": "arc3,rad=0.18",
        },
    )


def draw_store_cards(fig: plt.Figure, overall: pd.Series) -> None:
    positions = [0.09, 0.37, 0.65]
    width = 0.24
    height = 0.075

    for x0, store in zip(positions, STORE_ORDER):
        ax = fig.add_axes([x0, 0.742, width, height])
        ax.axis("off")

        card = FancyBboxPatch(
            (0, 0),
            1,
            1,
            boxstyle="round,pad=0.02,rounding_size=0.04",
            fc="#faf8f4",
            ec="#ddd9d1",
            lw=1.0,
        )
        ax.add_patch(card)
        ax.text(0.07, 0.79, STORE_LABELS[store], fontsize=10, fontweight="bold", color="#2b2b2b")
        ax.text(0.07, 0.41, f"{overall[store]:.0%}", fontsize=20, fontweight="bold", color=STORE_COLORS[store])
        ax.text(0.07, 0.18, "ultra-processed overall", fontsize=8.8, color="#5a5a5a")
        ax.add_patch(
            FancyBboxPatch(
                (0.60, 0.31),
                0.31,
                0.13,
                boxstyle="round,pad=0.01,rounding_size=0.03",
                fc="#ece7dc",
                ec="none",
            )
        )
        ax.add_patch(
            FancyBboxPatch(
                (0.60, 0.31),
                0.31 * float(overall[store]),
                0.13,
                boxstyle="round,pad=0.01,rounding_size=0.03",
                fc=STORE_COLORS[store],
                ec="none",
            )
        )


def plot_chart(overall: pd.Series, category_summary: pd.DataFrame) -> plt.Figure:
    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "axes.titlesize": 15,
            "axes.labelsize": 11,
            "xtick.labelsize": 10,
            "ytick.labelsize": 10,
        }
    )

    fig = plt.figure(figsize=(10.5, 12.7), facecolor="#f7f4ef")
    ax = fig.add_axes([0.13, 0.11, 0.62, 0.52], facecolor="white")

    fig.text(0.07, 0.963, TITLE, fontsize=18.5, fontweight="bold", color="#1f1f1f", va="top", linespacing=1.05)
    fig.text(
        0.07,
        0.885,
        "Share of products classified as ultra-processed (NOVA 4) in categories sold by Whole Foods, Walmart, and Target.\n"
        "Main chart keeps only categories with at least 75 items in every store (20 categories, 17,999 products); categories are sorted by average ultra-processed share.",
        fontsize=9.8,
        color="#555555",
        va="top",
        linespacing=1.35,
    )

    fig.text(0.07, 0.69, "Overall assortment mix", fontsize=11, fontweight="bold", color="#2a2a2a")
    fig.text(
        0.07,
        0.668,
        "Whole Foods is the least processed overall and in 17 of the 20 comparable categories below.",
        fontsize=9.9,
        color="#555555",
    )
    draw_store_cards(fig, overall)

    y = np.arange(len(category_summary))
    low_mask = category_summary["avg"] < 0.80
    high_mask = category_summary["avg"] >= 0.90
    low_rows = np.flatnonzero(low_mask)
    high_rows = np.flatnonzero(high_mask)
    low_median = float(category_summary.loc[low_mask, "spread"].median() * 100)
    high_median = float(category_summary.loc[high_mask, "spread"].median() * 100)

    if len(low_rows):
        ax.axhspan(low_rows[0] - 0.5, low_rows[-1] + 0.5, color="#eef6f1", zorder=0)
    if len(high_rows):
        ax.axhspan(high_rows[0] - 0.5, high_rows[-1] + 0.5, color="#fbf0e7", zorder=0)

    for idx, row in category_summary.iterrows():
        values = row[STORE_ORDER].to_numpy(dtype=float) * 100
        ax.hlines(
            idx,
            values.min(),
            values.max(),
            color="#b8b8b8",
            linewidth=2.1,
            zorder=1,
        )
        for store in STORE_ORDER:
            ax.scatter(
                row[store] * 100,
                idx,
                s=90,
                color=STORE_COLORS[store],
                edgecolor="white",
                linewidth=1.0,
                zorder=3,
            )

    ax.set_xlim(0, 100)
    ax.set_xticks(np.arange(0, 101, 10))
    ax.xaxis.set_major_formatter(PercentFormatter(100))
    ax.set_yticks(y)
    ax.set_yticklabels(category_summary["label"])
    ax.invert_yaxis()
    ax.grid(axis="x", color="#dedede", linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_xlabel("Share of products classified as ultra-processed")
    style_axes(ax)

    trans = blended_transform_factory(ax.transAxes, ax.transData)
    if len(low_rows):
        ax.text(
            1.02,
            (low_rows[0] + low_rows[-1]) / 2,
            f"Below 80% ultra-processed:\nmedian store spread = {low_median:.1f} points",
            transform=trans,
            fontsize=9.6,
            color="#2f5f52",
            va="center",
            linespacing=1.35,
        )
    if len(high_rows):
        ax.text(
            1.02,
            (high_rows[0] + high_rows[-1]) / 2,
            f"Above 90% ultra-processed:\nmedian store spread = {high_median:.1f} points",
            transform=trans,
            fontsize=9.6,
            color="#875a30",
            va="center",
            linespacing=1.35,
        )

    row_map = dict(zip(category_summary["category"], y))
    lookup = category_summary.set_index("category")
    add_annotation(
        ax,
        "Beans stay mostly minimally processed,\nbut Target still carries more\nultra-processed options than Whole Foods.",
        float(lookup.loc["produce-beans-wf", "Target"] * 100),
        float(row_map["produce-beans-wf"]),
        41,
        float(row_map["produce-beans-wf"] + 1.2),
    )
    add_annotation(
        ax,
        "Seafood shows the largest store gap:\n27% ultra-processed at Whole Foods\nversus 58% at Walmart.",
        float(lookup.loc["seafood", "Walmart"] * 100),
        float(row_map["seafood"]),
        69,
        float(row_map["seafood"] + 1.6),
    )
    add_annotation(
        ax,
        "Once you get to cookies, chips,\nbread, and cakes, every store is\nalready above 93% ultra-processed.",
        float(lookup.loc["cookies-biscuit", "WholeFoods"] * 100),
        float(row_map["cookies-biscuit"]),
        49,
        float(row_map["cookies-biscuit"] - 2.0),
    )

    fig.text(
        0.07,
        0.055,
        "Source: simplified GroceryDB dataset used in course materials. Each product counts once, so the chart reflects assortment mix rather than shelf space or sales volume.",
        fontsize=9,
        color="#5b5b5b",
    )
    return fig


def plot_writeup_page(paragraphs: list[str]) -> plt.Figure:
    fig = plt.figure(figsize=(8.5, 11), facecolor="white")
    ax = fig.add_axes([0.08, 0.06, 0.84, 0.88])
    ax.axis("off")

    ax.text(0, 0.98, "Write-up", fontsize=20, fontweight="bold", va="top")

    y = 0.90
    for paragraph in paragraphs:
        wrapped = textwrap.fill(paragraph, width=95)
        ax.text(0, y, wrapped, fontsize=12.2, color="#222222", va="top", linespacing=1.45)
        line_count = wrapped.count("\n") + 1
        y -= 0.06 + line_count * 0.029
    return fig


def save_outputs(
    chart: plt.Figure,
    writeup_page: plt.Figure,
    outdir: Path,
) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    chart_path = outdir / "grocerydb_expository_chart.png"
    pdf_path = outdir / "grocerydb_expository_submission.pdf"

    chart.savefig(chart_path, dpi=240, bbox_inches="tight", facecolor=chart.get_facecolor())
    with PdfPages(pdf_path) as pdf:
        pdf.savefig(chart, bbox_inches="tight", facecolor=chart.get_facecolor())
        pdf.savefig(writeup_page, bbox_inches="tight", facecolor=writeup_page.get_facecolor())

    plt.close(chart)
    plt.close(writeup_page)


def main() -> None:
    args = parse_args()
    if not args.data.exists():
        raise FileNotFoundError(f"Could not find dataset at {args.data}")
    if not args.writeup.exists():
        raise FileNotFoundError(f"Could not find write-up at {args.writeup}")

    df = pd.read_csv(args.data)
    paragraphs = read_writeup(args.writeup)
    overall, category_summary = prepare_data(df)
    chart = plot_chart(overall, category_summary)
    writeup_page = plot_writeup_page(paragraphs)
    save_outputs(chart, writeup_page, args.outdir)
    print(f"Wrote chart and PDF to {args.outdir}")


if __name__ == "__main__":
    main()
