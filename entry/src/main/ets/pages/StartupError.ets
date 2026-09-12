@Entry
@Component
struct StartupError {
  build() {
    Column({ space: 18 }) {
      Text('暂时无法打开成长打卡')
        .fontSize(30)
        .fontWeight(FontWeight.Bold)
        .fontColor('#7A4035')
      Text('本地数据读取失败，请关闭应用后重试。')
        .fontSize(20)
        .fontColor('#65584F')
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .backgroundColor('#FFF9EF')
  }
}
