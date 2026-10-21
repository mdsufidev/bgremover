# Contributing to PixCut Studio Frontend

Thank you for contributing to **PixCut Studio**! We welcome bug fixes, UI/UX polish, canvas algorithm optimizations, and new editor features.

---

## 🛠️ Getting Started

1. **Fork the Repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/<your-username>/bgremover.git
   cd bgremover
   ```
3. **Start local preview server:**
   ```bash
   # Using Python:
   python serve.py
   # Or using Node:
   npx serve .
   ```
   Open `http://localhost:3000` in your browser.

4. **Branching Guidelines:**
   - Feature: `feature/brush-smoothing`
   - Bugfix: `fix/canvas-dpi-scaling`

5. **Commit Conventions:**
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add zoom and pan gestures to touch devices`
   - `fix: prevent color bleeding during magic erase flood-fill`
   - `docs: update deployment instructions`

6. **Submit a PR:**
   Push your branch and open a Pull Request against `main`.
