declare module 'pdfmake/build/pdfmake' {
  const pdfMake: {
    createPdf: (docDefinition: any) => {
      download: (filename: string) => void
    }
    vfs?: any
    fonts?: any
  }
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
