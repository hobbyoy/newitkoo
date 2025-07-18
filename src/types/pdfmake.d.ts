declare module 'pdfmake/build/pdfmake' {
  interface PdfMake {
    createPdf: (docDefinition: object) => {
      download: (filename?: string) => void
    }
    vfs?: Record<string, string>
    fonts?: unknown
  }

  const pdfMake: PdfMake
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfsFonts: {
    pdfMake: {
      vfs: Record<string, string>
    }
  }
  export default vfsFonts
}
